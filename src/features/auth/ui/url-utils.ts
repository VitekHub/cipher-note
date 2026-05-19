export function isSafeRedirect(url: string | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//')
}
