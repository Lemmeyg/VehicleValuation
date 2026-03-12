import { redirect } from 'next/navigation'

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const query = new URLSearchParams(params).toString()
  redirect(`/auth${query ? `?${query}` : ''}`)
}
