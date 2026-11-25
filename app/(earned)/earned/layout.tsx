import { GameProvider } from "@/components/earned/GameProvider";
import Shell from "@/components/earned/Shell";

export default function EarnedLayout({ children }: LayoutProps<"/earned">) {
  return (
    <GameProvider>
      <Shell>{children}</Shell>
    </GameProvider>
  );
}
