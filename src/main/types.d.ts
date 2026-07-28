/** `ffprobe-static` n'expose pas de typings ; seul le chemin du binaire nous intéresse. */
declare module 'ffprobe-static' {
  const ffprobe: { path: string }
  export default ffprobe
}
