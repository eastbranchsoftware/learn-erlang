import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const lessons = await getCollection('lessons');
  const sortedLessons = lessons.sort((a, b) => a.data.postNumber - b.data.postNumber);
  
  return rss({
    title: 'Learn Erlang Step-By-Step',
    description: 'Build a real-time WebSocket chat server from scratch using pure Erlang',
    site: context.site,
    items: sortedLessons.map((lesson) => ({
      title: `Lesson ${lesson.data.postNumber}: ${lesson.data.title}`,
      pubDate: lesson.data.publishDate,
      description: lesson.data.description,
      link: `/lessons/${lesson.id}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}