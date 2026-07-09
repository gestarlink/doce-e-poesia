import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Banner {
  id: string;
  titulo: string;
  subtitulo: string;
  emoji: string;
  imagem_url: string | null;
  link_url: string | null;
}

const PromoBanner = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("banners")
        .select("id, titulo, subtitulo, emoji, imagem_url, link_url")
        .eq("ativo", true)
        .order("ordem");
      setBanners((data as Banner[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % (banners.length || 1));
  }, [banners.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + (banners.length || 1)) % (banners.length || 1));
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(next, 4000);
    return () => clearInterval(interval);
  }, [next, banners.length]);

  const handleBannerClick = () => {
    const link = banners[current % banners.length]?.link_url;
    if (!link) return;
    if (link.startsWith("http")) {
      window.open(link, "_blank", "noopener");
    } else {
      navigate(link);
    }
  };

  if (loading || banners.length === 0) return null;

  const slide = banners[current % banners.length];
  const hasImage = !!slide.imagem_url;
  const isClickable = !!slide.link_url;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        onClick={handleBannerClick}
        className={`relative rounded-xl min-h-[100px] flex items-center p-4 transition-all duration-500 ${isClickable ? "cursor-pointer" : ""}`}
        style={hasImage ? { backgroundImage: `url(${slide.imagem_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        {hasImage && <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-black/10 rounded-xl" />}
        {!hasImage && <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80 rounded-xl" />}

        <div className="relative flex-1 min-w-0">
          <p className="font-bold text-base leading-tight text-primary-foreground">{slide.titulo}</p>
          <p className="text-primary-foreground/80 text-xs mt-1">{slide.subtitulo}</p>
        </div>
        <span className="relative text-4xl ml-2 flex-shrink-0">{slide.emoji}</span>
      </div>

      {banners.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors shadow-sm" aria-label="Anterior">
            <ChevronLeft className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors shadow-sm" aria-label="Próximo">
            <ChevronRight className="w-3.5 h-3.5 text-foreground" />
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                className={`h-1.5 rounded-full transition-all ${i === current ? "bg-primary-foreground w-4" : "bg-primary-foreground/40 w-1.5"}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PromoBanner;
