import { GameProvider } from "@/components/meros/GameProvider";
import Shell from "@/components/meros/Shell";

export default function MerosLayout({ children }: LayoutProps<"/meros">) {
  return (
    <GameProvider>
      <Shell>{children}</Shell>
    </GameProvider>
  );
}
