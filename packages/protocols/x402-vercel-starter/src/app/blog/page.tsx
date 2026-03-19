import Link from "next/link";

export default function BlogPage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <p>
        (this page is protected by an x402 paywall only for bots, to simulate
        being detected as a bot you can set{" "}
        <Link href="/blog?bot=true" className="underline">
          ?bot=true
        </Link>
        )
      </p>
      <div className="py-4"></div>
      <h1 className="text-4xl font-bold mb-8">My Blog</h1>

      <div className="space-y-12">
        <article className="prose">
          <h2 className="text-2xl font-semibold mb-4">
            Getting Started with Next.js
          </h2>
          <div className="text-gray-600 mb-4">Posted on January 15, 2024</div>
          <p className="mb-4">
            Next.js is a powerful React framework that makes building web
            applications a breeze. In this post, we'll explore the key features
            that make Next.js stand out...
          </p>
          <a href="#" className="text-blue-600 hover:underline">
            Read more →
          </a>
        </article>

        <article className="prose">
          <h2 className="text-2xl font-semibold mb-4">
            Understanding TypeScript
          </h2>
          <div className="text-gray-600 mb-4">Posted on January 10, 2024</div>
          <p className="mb-4">
            TypeScript adds static typing to JavaScript, making your code more
            reliable and easier to maintain. Let's dive into some of the most
            useful TypeScript features...
          </p>
          <a href="#" className="text-blue-600 hover:underline">
            Read more →
          </a>
        </article>
      </div>
    </main>
  );
}
