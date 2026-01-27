/**
 * Next.js App Router API route for testing - Posts
 */
import { NextRequest, NextResponse } from 'next/server';

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

/**
 * Get all posts
 * @tag Posts
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get('page') || '1';
  const authorId = searchParams.get('authorId');
  
  const posts: Post[] = [];
  
  return NextResponse.json({
    posts,
    page: parseInt(page),
    total: 0,
  });
}

/**
 * Create a new post
 * @tag Posts
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  
  if (!authorization) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const body = await request.json();
  
  const post: Post = {
    id: crypto.randomUUID(),
    title: body.title,
    content: body.content,
    authorId: body.authorId,
  };
  
  return NextResponse.json(post, { status: 201 });
}
