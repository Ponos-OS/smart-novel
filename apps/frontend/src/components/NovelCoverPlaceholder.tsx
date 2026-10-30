interface NovelCoverPlaceholderProps {
  title: string;
  className?: string;
}

export function getCoverGradient(title: string): string {
  let hash = 0;

  for (const char of title) {
    hash = (hash * 31 + char.codePointAt(0)!) % 360;
  }

  const startHue = hash;
  const endHue = (hash + 50) % 360;

  return `linear-gradient(135deg, hsl(${startHue} 70% 45%), hsl(${endHue} 75% 25%))`;
}

export function NovelCoverPlaceholder({
  title,
  className = 'h-32 w-24',
}: NovelCoverPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={title}
      style={{ backgroundImage: getCoverGradient(title) }}
      className={`flex items-center justify-center rounded p-2 text-center shadow-inner ${className}`}
    >
      <span className="line-clamp-4 break-words text-sm font-semibold leading-tight text-white drop-shadow">
        {title}
      </span>
    </div>
  );
}
