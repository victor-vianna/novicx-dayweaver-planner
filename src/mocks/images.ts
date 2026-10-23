// Demo art for the fictional posts (4:5, 1024x1280).
import mAutocuidado from "@/assets/posts/m-autocuidado.jpg";
import mPausas1 from "@/assets/posts/m-pausas-1.jpg";
import mPausas2 from "@/assets/posts/m-pausas-2.jpg";
import mPausas3 from "@/assets/posts/m-pausas-3.jpg";
import mJanela from "@/assets/posts/m-janela.jpg";
import mLimites from "@/assets/posts/m-limites.jpg";
import mRotina1 from "@/assets/posts/m-rotina-1.jpg";
import mRotina2 from "@/assets/posts/m-rotina-2.jpg";
import mRotina3 from "@/assets/posts/m-rotina-3.jpg";
import mDomingo from "@/assets/posts/m-domingo.jpg";
import mHistTudo from "@/assets/posts/m-hist-tudo.jpg";
import mHistCha from "@/assets/posts/m-hist-cha.jpg";
import mHistSono from "@/assets/posts/m-hist-sono.jpg";
import mHistEscuta from "@/assets/posts/m-hist-escuta.jpg";
import rConstancia from "@/assets/posts/r-constancia.jpg";
import rCorrida from "@/assets/posts/r-corrida.jpg";
import hContrato from "@/assets/posts/h-contrato.jpg";
import hEscritorio from "@/assets/posts/h-escritorio.jpg";

export const IMAGES = {
  mAutocuidado,
  mPausas1,
  mPausas2,
  mPausas3,
  mJanela,
  mLimites,
  mRotina1,
  mRotina2,
  mRotina3,
  mDomingo,
  mHistTudo,
  mHistCha,
  mHistSono,
  mHistEscuta,
  rConstancia,
  rCorrida,
  hContrato,
  hEscritorio,
} as const;

export type ImageKey = keyof typeof IMAGES;
