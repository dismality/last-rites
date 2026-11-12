import { useState } from 'react'

interface Props {
  url: string
  /** The font rune: alt text for the image, and what shows if the file fails to load. */
  fallback: string
  sizePx: number
  className?: string
}

/** Pixel-art image at `sizePx`; unsmoothed. On a load error the font rune takes its place. */
export function PixelIcon({ url, fallback, sizePx, className }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (failedUrl === url) {
    return <span className={className}>{fallback}</span>
  }
  return (
    <img
      className={className}
      src={url}
      width={sizePx}
      height={sizePx}
      alt={fallback}
      draggable={false}
      style={{ imageRendering: 'pixelated' }}
      onError={() => setFailedUrl(url)}
    />
  )
}
