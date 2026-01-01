import { getArticleBySlugStatic, getAllArticleSlugs } from '@/lib/knowledge-base-db'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const article = await getArticleBySlugStatic(slug)

  if (!article) return {}

  return {
    title: `${article.title} | Vehicle Valuation Authority`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      authors: [article.author],
      tags: article.tags,
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = await getArticleBySlugStatic(slug)

  if (!article) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-24 pb-16">
        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="mb-8">
            <div className="mb-4">
              <span className="inline-block px-3 py-1 text-sm font-semibold text-primary-600 bg-primary-50 rounded-full">
                {article.category}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {article.title}
            </h1>
            <div className="flex items-center text-sm text-slate-600 space-x-4">
              <span>{article.author}</span>
              <span>•</span>
              <time>{new Date(article.datePublished).toLocaleDateString()}</time>
              <span>•</span>
              <span>{article.readingTime}</span>
            </div>
          </header>

          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: article.htmlContent! }}
          />
        </article>
      </main>
      <Footer />
    </div>
  )
}
