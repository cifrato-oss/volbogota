import { CentrosSection } from "@/components/centros/centros-section";
import { HomeHero } from "@/components/home/home-hero";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <HomeHero />
      <CentrosSection />
    </div>
  );
}
