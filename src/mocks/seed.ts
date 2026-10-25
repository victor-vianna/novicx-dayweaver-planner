// Fictional demo data. Dates are generated relative to "today" in São Paulo so
// the prototype always opens with a current package, past and upcoming posts.
import { addDays, todayISO } from "@/lib/dates";
import type {
  Client,
  ClientPackage,
  InternalNote,
  Plan,
  Post,
  PostEvent,
  PostMedia,
  Profile,
} from "@/types/domain";
import { IMAGES, type ImageKey } from "./images";

export interface MockDB {
  version: number;
  seededFor: string;
  profiles: Profile[];
  clients: Client[];
  plans: Plan[];
  packages: ClientPackage[];
  posts: Post[];
  media: PostMedia[];
  notes: InternalNote[];
  /** Optional: sessions saved before the history existed have none. */
  events?: PostEvent[];
}

export const DB_VERSION = 1;

export const DEMO_ACCOUNTS = {
  client: { email: "marina@exemplo.com.br", password: "demo1234", profileId: "u-marina" },
  admin: { email: "equipe@novicx.com.br", password: "demo1234", profileId: "u-admin" },
} as const;

interface PostSeed {
  id: string;
  client: string;
  pkg: string;
  title: string;
  caption: string | null;
  offset: number;
  time: string;
  status: Post["status"];
  images: ImageKey[];
}

export function createSeed(now: Date = new Date()): MockDB {
  const today = todayISO(now);
  const d = (offset: number) => addDays(today, offset);

  const profiles: Profile[] = [
    { id: "u-admin", role: "admin", full_name: "Equipe NOVICX" },
    { id: "u-marina", role: "client", full_name: "Marina Alves" },
    { id: "u-rafael", role: "client", full_name: "Rafael Monteiro" },
    { id: "u-helena", role: "client", full_name: "Helena Prado" },
    { id: "u-camila", role: "client", full_name: "Camila Reis" },
  ];

  const clients: Client[] = [
    {
      id: "c-marina",
      user_id: "u-marina",
      display_name: "Marina",
      business_name: "Marina Alves",
      profession: "Psicóloga",
      email: DEMO_ACCOUNTS.client.email,
      phone: "(11) 98734-2210",
      archived_at: null,
    },
    {
      id: "c-rafael",
      user_id: "u-rafael",
      display_name: "Rafael",
      business_name: "RM Treinamento",
      profession: "Personal trainer",
      email: "rafael@rmtreinamento.com.br",
      phone: "(11) 99412-8833",
      archived_at: null,
    },
    {
      id: "c-helena",
      user_id: "u-helena",
      display_name: "Helena",
      business_name: "Prado Advocacia de Família",
      profession: "Advogada",
      email: "helena@pradoadvocacia.com.br",
      phone: "(21) 98120-4477",
      archived_at: null,
    },
    {
      id: "c-camila",
      user_id: "u-camila",
      display_name: "Camila",
      business_name: "Camila Reis Consultoria",
      profession: "Consultora de carreira",
      email: "camila@camilareis.com.br",
      phone: "(31) 99701-5522",
      archived_at: null,
    },
  ];

  const plans: Plan[] = [
    {
      id: "plan-cd8",
      name: "Conteúdo + Design · 8 posts",
      posts_per_period: 8,
      period_days: 30,
      default_weekdays: [2, 4],
      default_times: ["10:00", "19:00"],
      active: true,
    },
    {
      id: "plan-cd12",
      name: "Conteúdo + Design · 12 posts",
      posts_per_period: 12,
      period_days: 30,
      default_weekdays: [1, 3, 5],
      default_times: ["07:30", "18:30"],
      active: true,
    },
    {
      id: "plan-dp4",
      name: "Design de Posts · 4 posts",
      posts_per_period: 4,
      period_days: 30,
      default_weekdays: [3],
      default_times: ["12:00"],
      active: true,
    },
    {
      id: "plan-dp6-legacy",
      name: "Design de Posts · Essencial (antigo)",
      posts_per_period: 6,
      period_days: 30,
      default_weekdays: [2, 5],
      default_times: ["11:00"],
      active: false,
    },
  ];

  const packages: ClientPackage[] = [
    {
      id: "pkg-marina-prev",
      client_id: "c-marina",
      plan_id: "plan-dp4",
      // Snapshot keeps the name the client contracted, even after the catalog changed.
      plan_name_snapshot: "Design de Posts · Essencial",
      posts_total: 4,
      start_date: d(-44),
      end_date: d(-15),
      status: "ended",
    },
    {
      id: "pkg-marina",
      client_id: "c-marina",
      plan_id: "plan-cd8",
      plan_name_snapshot: "Conteúdo + Design · 8 posts",
      posts_total: 8,
      start_date: d(-14),
      end_date: d(15),
      status: "active",
    },
    {
      id: "pkg-rafael",
      client_id: "c-rafael",
      plan_id: "plan-cd12",
      plan_name_snapshot: "Conteúdo + Design · 12 posts",
      posts_total: 12,
      start_date: d(-6),
      end_date: d(23),
      status: "active",
    },
    {
      id: "pkg-helena",
      client_id: "c-helena",
      plan_id: "plan-dp4",
      plan_name_snapshot: "Design de Posts · 4 posts",
      posts_total: 4,
      start_date: d(-24),
      end_date: d(5),
      status: "active",
    },
  ];

  const seeds: PostSeed[] = [
    // Marina — previous package (ended)
    {
      id: "p-m-h1",
      client: "c-marina",
      pkg: "pkg-marina-prev",
      title: "Você não precisa dar conta de tudo",
      caption:
        "Existe uma pressão silenciosa para dar conta de tudo: trabalho, casa, relações, corpo, mente.\n\nMas ninguém dá conta de tudo o tempo todo. E tudo bem. 🤍\n\nPedir ajuda não é fraqueza — é maturidade.",
      offset: -40,
      time: "12:00",
      status: "published",
      images: ["mHistTudo"],
    },
    {
      id: "p-m-h2",
      client: "c-marina",
      pkg: "pkg-marina-prev",
      title: "Um momento só seu",
      caption: null,
      offset: -33,
      time: "12:00",
      status: "published",
      images: ["mHistCha"],
    },
    {
      id: "p-m-h3",
      client: "c-marina",
      pkg: "pkg-marina-prev",
      title: "Sono também é saúde mental",
      caption:
        "Dormir mal por uma noite acontece. Dormir mal por semanas muda o humor, a paciência e o foco.\n\n🌙 Cuide do seu sono como cuida da sua agenda.",
      offset: -26,
      time: "12:00",
      status: "published",
      images: ["mHistSono"],
    },
    {
      id: "p-m-h4",
      client: "c-marina",
      pkg: "pkg-marina-prev",
      title: "Escutar é diferente de esperar a sua vez",
      caption:
        "Quantas vezes você ouviu alguém só esperando a sua vez de falar?\n\nEscuta de verdade é presença. É curiosidade. É deixar o outro terminar.\n\nTente hoje. 👂",
      offset: -19,
      time: "12:00",
      status: "published",
      images: ["mHistEscuta"],
    },
    // Marina — current package
    {
      id: "p-m-1",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "Autocuidado também é produtividade",
      caption:
        "Cuidar da sua saúde mental não é um luxo, é uma base para tudo o que você constrói. 💜\n\nQuando você descansa, organiza seus pensamentos e respeita seus limites, sua produtividade deixa de ser cansaço e passa a ser constância.\n\nQual pequeno cuidado você vai se dar hoje?",
      offset: -12,
      time: "10:00",
      status: "published",
      images: ["mAutocuidado"],
    },
    {
      id: "p-m-2",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "Pequenas pausas, grandes resultados",
      caption:
        "Você não precisa de férias para recuperar a energia. Às vezes, precisa de cinco minutos. ⏸️\n\nArraste para o lado e veja duas pausas simples que cabem em qualquer rotina.\n\nSalve este post para lembrar durante a semana.",
      offset: -8,
      time: "19:00",
      status: "published",
      images: ["mPausas1", "mPausas2", "mPausas3"],
    },
    {
      id: "p-m-3",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "Um canto para respirar",
      caption: null,
      offset: -3,
      time: "12:00",
      status: "ready",
      images: ["mJanela"],
    },
    {
      id: "p-m-4",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "O poder dos seus limites",
      caption:
        "Dizer não também é uma forma de cuidado — com você e com quem convive com você.\n\nLimites claros evitam ressentimentos silenciosos e deixam as relações mais leves. ✨\n\nVocê tem facilidade ou dificuldade em dizer não? Me conta nos comentários.",
      offset: 0,
      time: "19:00",
      status: "ready",
      images: ["mLimites"],
    },
    {
      id: "p-m-5",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "Rotina que funciona de verdade",
      caption:
        "Rotina boa não é rotina perfeita. É rotina possível. 🗓️\n\nNeste carrossel, dois passos simples para começar sem se cobrar demais.\n\nCompartilhe com alguém que está tentando se organizar.",
      offset: 4,
      time: "10:00",
      status: "ready",
      images: ["mRotina1", "mRotina2", "mRotina3"],
    },
    {
      id: "p-m-6",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "Ansiedade de domingo à noite?",
      caption:
        "Aquele aperto que aparece no domingo à noite tem nome — e tem manejo.\n\nAntecipar a semana inteira de uma vez faz o corpo reagir como se tudo fosse acontecer agora. 🌙\n\nNo próximo post, trago três estratégias práticas. Ative as notificações para não perder.",
      offset: 7,
      time: "20:00",
      status: "ready",
      images: ["mDomingo"],
    },
    {
      id: "p-m-7",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "Terapia online funciona?",
      caption: null,
      offset: 10,
      time: "10:00",
      status: "draft",
      images: [],
    },
    {
      id: "p-m-8",
      client: "c-marina",
      pkg: "pkg-marina",
      title: "Como escolher um profissional",
      caption: null,
      offset: 13,
      time: "19:00",
      status: "draft",
      images: [],
    },
    // Rafael
    {
      id: "p-r-1",
      client: "c-rafael",
      pkg: "pkg-rafael",
      title: "Antes do treino da manhã",
      caption:
        "O treino começa antes do primeiro passo. 👟\n\nHidratação, 5 minutos de mobilidade e um objetivo claro para o dia.\n\nBora?",
      offset: -2,
      time: "07:30",
      status: "published",
      images: ["rCorrida"],
    },
    {
      id: "p-r-2",
      client: "c-rafael",
      pkg: "pkg-rafael",
      title: "Constância vence intensidade",
      caption:
        "Treinar pesado uma semana e sumir no mês seguinte não leva ninguém longe. 💪\n\nTrês treinos por semana, todas as semanas, mudam o seu corpo e a sua cabeça.\n\nMarque quem precisa ler isso hoje.",
      offset: 2,
      time: "18:30",
      status: "ready",
      images: ["rConstancia"],
    },
    {
      id: "p-r-3",
      client: "c-rafael",
      pkg: "pkg-rafael",
      title: "3 erros no agachamento",
      caption: null,
      offset: 5,
      time: "07:30",
      status: "draft",
      images: [],
    },
    // Helena
    {
      id: "p-h-1",
      client: "c-helena",
      pkg: "pkg-helena",
      title: "Antes de assinar, leia isto",
      caption:
        "Um acordo de família mexe com patrimônio, rotina e, principalmente, com pessoas.\n\nAntes de assinar, preste atenção em quatro pontos: guarda, convivência, pensão e partilha. ⚖️\n\nDúvidas? Agende uma conversa.",
      offset: -10,
      time: "12:00",
      status: "published",
      images: ["hContrato"],
    },
    {
      id: "p-h-2",
      client: "c-helena",
      pkg: "pkg-helena",
      title: "Atendimento com escuta e sigilo",
      caption: null,
      offset: 3,
      time: "12:00",
      status: "ready",
      images: ["hEscritorio"],
    },
    {
      id: "p-h-3",
      client: "c-helena",
      pkg: "pkg-helena",
      title: "Guarda compartilhada: mitos e verdades",
      caption: null,
      offset: 5,
      time: "12:00",
      status: "draft",
      images: [],
    },
  ];

  const posts: Post[] = [];
  const media: PostMedia[] = [];
  for (const s of seeds) {
    const date = d(s.offset);
    posts.push({
      id: s.id,
      client_id: s.client,
      client_package_id: s.pkg,
      format: s.images.length > 1 ? "carousel" : "single",
      title: s.title,
      caption: s.caption,
      scheduled_date: date,
      scheduled_time: s.time,
      status: s.status,
      published_at: s.status === "published" ? `${date}T${s.time}:00-03:00` : null,
      published_by: s.status === "published" ? "client" : null,
    });
    s.images.forEach((key, i) => {
      media.push({
        id: `${s.id}-m${i + 1}`,
        post_id: s.id,
        storage_path: `clients/${s.client}/posts/${s.id}/${i + 1}.jpg`,
        url: IMAGES[key],
        position: i,
        width: 1024,
        height: 1280,
      });
    });
  }

  const notes: InternalNote[] = [
    {
      id: "n-1",
      client_id: "c-marina",
      post_id: null,
      body: "Prefere receber as artes até quinta-feira. Evitar tons muito saturados — paleta terrosa aprovada.",
      created_at: `${d(-20)}T14:12:00-03:00`,
    },
    {
      id: "n-2",
      client_id: "c-marina",
      post_id: "p-m-7",
      body: "Confirmar com a Marina se ela quer citar valores da sessão online (provavelmente não).",
      created_at: `${d(-2)}T10:40:00-03:00`,
    },
    {
      id: "n-3",
      client_id: "c-helena",
      post_id: null,
      body: "Toda arte passa pela revisão da OAB-friendly: sem promessas de resultado.",
      created_at: `${d(-18)}T09:05:00-03:00`,
    },
  ];

  return {
    version: DB_VERSION,
    seededFor: today,
    profiles,
    clients,
    plans,
    packages,
    posts,
    media,
    notes,
  };
}
