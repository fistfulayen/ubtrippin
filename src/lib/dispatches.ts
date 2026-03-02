import fs from 'node:fs'
import { cache } from 'react'
import path from 'node:path'
import matter from 'gray-matter'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { unified } from 'unified'

const dispatchesDirectory = path.join(process.cwd(), 'content/dispatches')

interface DispatchFrontmatter {
  title: string
  date: string
  slug: string
  summary: string
  author: string
}

export interface Dispatch extends DispatchFrontmatter {
  content: string
}

function parseDispatchFile(fileName: string): Dispatch {
  const fullPath = path.join(dispatchesDirectory, fileName)
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  const frontmatter = data as Partial<DispatchFrontmatter>
  const slug = frontmatter.slug ?? fileName.replace(/\.md$/, '')

  if (!frontmatter.title || !frontmatter.date || !frontmatter.summary || !frontmatter.author) {
    throw new Error(`Invalid dispatch frontmatter in ${fileName}`)
  }

  return {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    summary: frontmatter.summary,
    author: frontmatter.author,
    content,
  }
}

export const getAllDispatches = cache((): Dispatch[] => {
  if (!fs.existsSync(dispatchesDirectory)) {
    return []
  }

  const fileNames = fs.readdirSync(dispatchesDirectory)

  const dispatches = fileNames
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => parseDispatchFile(fileName))

  return dispatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(markdown)
  return String(file)
}

export function getDispatchBySlug(slug: string): Dispatch | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  const dispatches = getAllDispatches()
  return dispatches.find((dispatch) => dispatch.slug === slug) ?? null
}
