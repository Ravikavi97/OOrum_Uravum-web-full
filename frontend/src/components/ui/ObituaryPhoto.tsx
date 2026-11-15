import ObituaryPlaceholder from '@/components/ui/ObituaryPlaceholder';

interface ObituaryPhotoProps {
  src: string | null;
  alt: string;
  className?: string;
}

export default function ObituaryPhoto({ src, alt, className = '' }: ObituaryPhotoProps) {
  return (
    <span className="absolute inset-0 block">
      <ObituaryPlaceholder className="absolute inset-0" />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className={`relative ${className}`} />
      )}
    </span>
  );
}
