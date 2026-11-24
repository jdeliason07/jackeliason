import { site } from "@/lib/config";
import BottleViewer from "./BottleViewer";
import Reveal from "./Reveal";

/** The homepage's product chapter: the venture in lib/config.ts that has a `product`, in 3D. */
export default function Bottle() {
  const venture = site.ventures.find((item) => item.product);
  if (!venture?.product) return null;
  const { product } = venture;

  return (
    <section aria-labelledby="bottle-heading" className="text-center">
      <Reveal>
        <h2 id="bottle-heading" className="font-display text-[3.5rem] leading-none sm:text-[4.5rem]">
          {product.name}
        </h2>
        <p className="mt-3 text-[1.1875rem] text-muted italic sm:text-[1.3125rem]">{product.line}</p>
      </Reveal>
      <Reveal delay={120} className="mt-10">
        <BottleViewer name={product.name} brand={venture.name} logo={venture.logo} />
        <p className="smallcaps mt-6 text-muted">Drag to spin</p>
        <p className="mt-4">
          <a href={venture.url} className="draw smallcaps">
            {product.link}&nbsp;<span aria-hidden="true">→</span>
          </a>
        </p>
      </Reveal>
    </section>
  );
}
