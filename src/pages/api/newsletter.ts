import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const resend = new Resend(process.env.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await resend.contacts.create({
      email,
      firstName: 'Erlang',
      unsubscribed: false,
      audienceId: process.env.RESEND_AUDIENCE_ID ?? import.meta.env.RESEND_AUDIENCE_ID,
    });

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Newsletter signup error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to subscribe to newsletter',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};