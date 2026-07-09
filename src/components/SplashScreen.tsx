import { useEffect, useState } from "react";
import logoDocePoesia from "@/assets/logo-doce-poesia.png";

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 1000);
    const t2 = setTimeout(() => onFinish(), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-primary transition-opacity duration-500 ${fadeOut ? "opacity-0" : ""}`}
    >
      <div className="w-24 h-24 rounded-full bg-primary-foreground flex items-center justify-center shadow-xl">
        <img src={logoDocePoesia} alt="Doce & Poesia" className="w-16 h-16 object-contain" />
      </div>
      <h1 className="text-xl font-bold text-primary-foreground mt-4 tracking-tight">Doce & Poesia</h1>
    </div>
  );
};

export default SplashScreen;
