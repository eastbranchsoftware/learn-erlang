#!/usr/bin/env escript
%% -*- erlang -*-
%%
%% Checks lesson content against a real Erlang VM.
%%
%% Usage: check_lessons.escript <dir>
%%
%% Every `*.koan` file in <dir> holds koan code with the blank already
%% filled in. The code must scan and parse as Erlang. Function definitions
%% and attributes are compiled into a throwaway module. If the koan has
%% `% => Term` comments, the shell expressions are evaluated and each
%% result is compared with the term in the comment.
%%
%% Every `*.mod` file holds a complete module taken from a lesson code
%% block. It must compile.
%%
%% Prints one line per file: `ok <file>` or `fail <file> <reason>`.

-mode(compile).

main([Dir]) ->
    {ok, Names} = file:list_dir(Dir),
    Results = [check_file(Dir, Name) || Name <- lists:sort(Names)],
    case lists:member(fail, Results) of
        true -> halt(1);
        false -> halt(0)
    end;
main(_) ->
    io:format("usage: check_lessons.escript <dir>~n"),
    halt(2).

check_file(Dir, Name) ->
    Path = filename:join(Dir, Name),
    Check = case filename:extension(Name) of
        ".koan" -> fun check_koan/2;
        ".mod" -> fun check_module/2;
        _ -> skip
    end,
    case Check of
        skip ->
            ok;
        _ ->
            {ok, Bin} = file:read_file(Path),
            Text = unicode:characters_to_list(Bin),
            case run_isolated(fun() -> Check(Name, Text) end) of
                ok ->
                    io:format("ok ~ts~n", [Name]),
                    ok;
                {fail, Reason} ->
                    io:format("fail ~ts ~ts~n", [Name, one_line(Reason)]),
                    fail
            end
    end.

%% Run a check in its own process so crashes, leftover messages and
%% links cannot leak from one koan into the next.
run_isolated(Fun) ->
    Parent = self(),
    Ref = make_ref(),
    {Pid, MRef} = spawn_monitor(fun() -> Parent ! {Ref, Fun()} end),
    receive
        {Ref, Result} ->
            erlang:demonitor(MRef, [flush]),
            Result;
        {'DOWN', MRef, process, Pid, Reason} ->
            {fail, io_lib:format("crashed: ~p", [Reason])}
    after 10000 ->
        exit(Pid, kill),
        {fail, "timed out after 10 seconds"}
    end.

one_line(Reason) ->
    Flat = lists:flatten(io_lib:format("~ts", [Reason])),
    re:replace(Flat, "\\s+", " ", [global, {return, list}, unicode]).

%%% ------------------------------------------------------------------
%%% Koans
%%% ------------------------------------------------------------------

check_koan(Name, Text) ->
    ModName = list_to_atom("koan_" ++ integer_to_list(erlang:phash2(Name))),
    try
        Chunks = chunk(string:split(Text, "\n", all)),
        Parsed = [parse_chunk(C, ModName) || C <- Chunks],
        Forms = [F || {form, F, _} <- Parsed],
        Exprs = [{E, Expect} || {exprs, E, Expect} <- Parsed],
        Mod = compile_forms(Forms, ModName),
        HasExpectations = lists:any(fun({_, Ex}) -> Ex =/= none end, Exprs),
        case HasExpectations of
            true -> eval_exprs(Exprs, Mod);
            false -> ok
        end,
        ok
    catch
        throw:{fail, Reason} -> {fail, Reason}
    end.

%% Split lines into dot-terminated chunks. Each chunk carries the
%% `% => Term` expectation that follows it, if any.
chunk(Lines) ->
    chunk([strip_prompt(L) || L <- Lines], [], []).

chunk([], [], Acc) ->
    lists:reverse(Acc);
chunk([], Buf, _Acc) ->
    Src = lists:flatten(lists:join("\n", lists:reverse(Buf))),
    case has_tokens(Src) of
        true -> throw({fail, "code does not end with a full stop: " ++ Src});
        false -> throw({fail, "could not scan: " ++ Src})
    end;
chunk([Line | Rest], Buf, Acc) ->
    case {Buf, expectation(Line)} of
        {[], {expect, Term}} ->
            case Acc of
                [{Src, _} | Tail] -> chunk(Rest, [], [{Src, Term} | Tail]);
                [] -> throw({fail, "`% =>` comment with no expression before it"})
            end;
        _ ->
            Buf1 = [Line | Buf],
            Src = lists:flatten(lists:join("\n", lists:reverse(Buf1))),
            case complete(Src) of
                true -> chunk(Rest, [], [{Src, none} | Acc]);
                false -> chunk(Rest, Buf1, Acc);
                empty -> chunk(Rest, [], Acc)
            end
    end.

strip_prompt(Line) ->
    re:replace(Line, "^\\d+>\\s?", "", [{return, list}, unicode]).

expectation(Line) ->
    case re:run(Line, "^\\s*%+\\s*=>\\s*(.+?)\\s*$", [{capture, [1], list}, unicode]) of
        {match, [Term]} -> {expect, Term};
        nomatch -> none
    end.

has_tokens(Src) ->
    case erl_scan:string(Src) of
        {ok, [_ | _], _} -> true;
        _ -> false
    end.

complete(Src) ->
    case erl_scan:string(Src) of
        {ok, [], _} -> empty;
        {ok, Tokens, _} ->
            case lists:last(Tokens) of
                {dot, _} -> true;
                _ -> false
            end;
        {error, _, _} -> false
    end.

parse_chunk({Src, Expect}, ModName) ->
    {ok, Tokens0, _} = erl_scan:string(Src),
    Tokens = expand_module_macro(Tokens0, ModName),
    case erl_parse:parse_form(Tokens) of
        {ok, Form} ->
            {form, Form, Expect};
        {error, FormError} ->
            case erl_parse:parse_exprs(Tokens) of
                {ok, Exprs} ->
                    {exprs, Exprs, Expect};
                {error, _} ->
                    throw({fail, io_lib:format("syntax error: ~ts in: ~ts",
                                               [format_error(FormError), Src])})
            end
    end.

%% ?MODULE is the only macro koans may use.
expand_module_macro([{'?', _}, {var, L, 'MODULE'} | Rest], ModName) ->
    [{atom, L, ModName} | expand_module_macro(Rest, ModName)];
expand_module_macro([{'?', _}, {_, _, Macro} | _], _ModName) ->
    throw({fail, io_lib:format("macro ?~s is not supported in koans", [Macro])});
expand_module_macro([T | Rest], ModName) ->
    [T | expand_module_macro(Rest, ModName)];
expand_module_macro([], _ModName) ->
    [].

format_error({_Loc, Mod, Desc}) -> Mod:format_error(Desc);
format_error(Other) -> io_lib:format("~p", [Other]).

compile_forms([], _ModName) ->
    none;
compile_forms(Forms, ModName) ->
    {Mod, Forms1} = case [M || {attribute, _, module, M} <- Forms] of
        [M | _] -> {M, Forms};
        [] -> {ModName, [{attribute, 1, module, ModName} | Forms]}
    end,
    Opts = [export_all, nowarn_export_all, return_errors, nowarn_unused_vars,
            nowarn_unused_function, nowarn_unused_record],
    case compile:forms(Forms1, Opts) of
        {ok, Mod, Bin} ->
            load(Mod, Bin);
        {ok, Mod, Bin, _Warnings} ->
            load(Mod, Bin);
        {error, Errors, _Warnings} ->
            throw({fail, "compile error: " ++ format_compile_errors(Errors)})
    end.

load(Mod, Bin) ->
    code:purge(Mod),
    {module, Mod} = code:load_binary(Mod, atom_to_list(Mod) ++ ".erl", Bin),
    Mod.

format_compile_errors(Errors) ->
    lists:join("; ", [io_lib:format("line ~p: ~ts", [line(Loc), M:format_error(D)])
                      || {_File, Es} <- Errors, {Loc, M, D} <- Es]).

line({Line, _Col}) -> Line;
line(Line) -> Line.

eval_exprs(Exprs, Mod) ->
    Local = {value, fun(Name, Args) ->
        case Mod of
            none -> erlang:error({undefined_shell_function, Name, length(Args)});
            _ -> apply(Mod, Name, Args)
        end
    end},
    lists:foldl(fun({Es, Expect}, Bindings) ->
        {Value, Bindings1} =
            try erl_eval:exprs(Es, Bindings, Local) of
                {value, V, B} -> {V, B}
            catch
                Class:Reason ->
                    throw({fail, io_lib:format("evaluation raised ~p:~p in: ~ts",
                                               [Class, Reason, pretty(Es)])})
            end,
        check_expectation(Value, Expect, Es),
        Bindings1
    end, erl_eval:new_bindings(), Exprs),
    ok.

check_expectation(_Value, none, _Es) ->
    ok;
check_expectation(Value, TermSrc, Es) ->
    Expected = eval_term(TermSrc),
    case Value =:= Expected of
        true ->
            ok;
        false ->
            throw({fail, io_lib:format("~ts returned ~tp but the koan says ~ts",
                                       [pretty(Es), Value, TermSrc])})
    end.

eval_term(Src) ->
    Src1 = case lists:last(Src) of
        $. -> Src;
        _ -> Src ++ "."
    end,
    try
        {ok, Tokens, _} = erl_scan:string(Src1),
        {ok, Exprs} = erl_parse:parse_exprs(Tokens),
        {value, V, _} = erl_eval:exprs(Exprs, erl_eval:new_bindings()),
        V
    catch
        _:_ -> throw({fail, "cannot parse expected result: " ++ Src})
    end.

pretty(Es) ->
    lists:flatten(lists:join(", ", [erl_pp:expr(E) || E <- Es])).

%%% ------------------------------------------------------------------
%%% Full modules from lesson code blocks
%%% ------------------------------------------------------------------

check_module(Name, Text) ->
    case re:run(Text, "-module\\(\\s*'?([a-zA-Z0-9_@]+)'?\\s*\\)", [{capture, [1], list}]) of
        {match, [ModName]} -> compile_module(Name, ModName, Text);
        nomatch -> {fail, "no -module attribute"}
    end.

compile_module(Name, ModName, Text) ->
    Tmp = filename:join(filename:basedir(user_cache, "learn-erlang-check"),
                        integer_to_list(erlang:phash2(Name))),
    ok = filelib:ensure_path(Tmp),
    File = filename:join(Tmp, ModName ++ ".erl"),
    ok = file:write_file(File, unicode:characters_to_binary(Text)),
    Result = case compile:file(File, [binary, return_errors, return_warnings]) of
        {ok, _, _} -> ok;
        {ok, _, _, _} -> ok;
        {error, Errors, _} -> {fail, "compile error: " ++ format_compile_errors(Errors)}
    end,
    file:delete(File),
    Result.
