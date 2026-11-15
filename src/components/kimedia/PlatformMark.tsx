import { PLATFORMS, type Platform } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export function PlatformMark({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground font-mono text-[10px] font-semibold", `platform-${platform}`, className)}>
      {PLATFORMS[platform].short}
    </span>
  );
}
