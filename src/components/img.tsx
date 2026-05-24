import Image from "next/image";

interface ImgProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  objectFit?: "cover" | "contain" | "fill";
  priority?: boolean;
  className?: string;
}

export const Img = ({ src, alt, width, height, objectFit = "contain", priority = false, className = "" }: ImgProps) => {
  const objectFitClass = objectFit === "cover" ? "object-cover" : objectFit === "contain" ? "object-contain" : "object-fill";

  if (width && height) {
    return <Image src={src} alt={alt} width={width} height={height} className={`${objectFitClass} ${className}`} priority={priority} />;
  }

  return <Image src={src} alt={alt} fill className={`${objectFitClass} ${className}`} priority={priority} sizes="(max-width: 640px) 100vw, (max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" />;
};

interface AvatarImgProps {
  src: string;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs   md:w-8  md:h-8  md:text-xs",
  md: "w-8 h-8 text-xs   md:w-12 md:h-12 md:text-sm",
  lg: "w-12 h-12 text-sm md:w-16 md:h-16 md:text-base",
  xl: "w-16 h-16 text-base md:w-24 md:h-24 md:text-xl",
  "2xl": "w-20 h-20 text-lg md:w-28 md:h-28 md:text-2xl",
  "3xl": "w-24 h-24 text-xl md:w-32 md:h-32 md:text-2xl",
};

export const AvatarImg = ({ src, alt, size = "md", className = "" }: AvatarImgProps) => {
  return (
    <div className={`${sizeClasses[size]} ${className} relative rounded-full overflow-hidden shrink-0`}>
      <Image src={src} alt={alt} fill className="object-cover object-center" sizes="(max-width: 768px) 96px, 128px" priority />
    </div>
  );
};

interface BackgroundImgProps {
  src: string;
  alt: string;
  overlay?: boolean;
  overlayOpacity?: number;
  children?: React.ReactNode;
  className?: string;
}

export const BackgroundImg = ({ src, alt, overlay = true, overlayOpacity = 0.5, children, className = "" }: BackgroundImgProps) => {
  return (
    <div className={`relative ${className}`}>
      <Image src={src} alt={alt} fill className="object-cover" priority sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw" />
      {overlay && <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
};
