import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { StudioButton } from './StudioButton';

interface StudioCarouselProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const StudioCarousel: React.FC<StudioCarouselProps> = ({ children, className, contentClassName }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', dragFree: true, containScroll: 'trimSnaps' });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    updateButtons();
    emblaApi.on('select', updateButtons);
    emblaApi.on('reInit', updateButtons);
    return () => {
      emblaApi.off('select', updateButtons);
      emblaApi.off('reInit', updateButtons);
    };
  }, [emblaApi, updateButtons]);

  return (
    <div className={cn('group relative', className)}>
      <div ref={emblaRef} className="studio-row-mask overflow-hidden">
        <div className={cn('flex touch-pan-y gap-3 px-7 py-4 md:gap-4 md:px-8', contentClassName)}>
          {children}
        </div>
      </div>

      {canScrollPrev && (
        <StudioButton
          type="button"
          size="icon"
          variant="glass"
          className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 md:inline-flex"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </StudioButton>
      )}

      {canScrollNext && (
        <StudioButton
          type="button"
          size="icon"
          variant="glass"
          className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 md:inline-flex"
          onClick={() => emblaApi?.scrollNext()}
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </StudioButton>
      )}
    </div>
  );
};

export const StudioCarouselItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('min-w-0 shrink-0 basis-[42%] sm:basis-[30%] md:basis-[22%] lg:basis-[17%] xl:basis-[13.6%]', className)} {...props} />
);
