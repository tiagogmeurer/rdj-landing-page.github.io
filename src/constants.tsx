import { CheckCircle2, DollarSign, Lock, Smartphone, Zap, ShieldCheck } from 'lucide-react';

export const BENEFITS = [
  {
    icon: <Smartphone className="w-8 h-8 text-brand-pink" />,
    title: "100% Pelo Celular",
    description: "Você não precisa de computador. Configure tudo na palma da sua mão em minutos."
  },
  {
    icon: <DollarSign className="w-8 h-8 text-brand-pink" />,
    title: "Ganhar em Dólar ou Real",
    description: "Venda conteúdo adulto feito por IA no Brasil ou no exterior, multiplicando seus ganhos automaticamente."
  },
  {
    icon: <Zap className="w-8 h-8 text-brand-pink" />,
    title: "Criação Rápida",
    description: "Sem configurações complexas. Ative o Robô e comece a rodar imediatamente."
  },
  {
    icon: <Lock className="w-8 h-8 text-brand-pink" />,
    title: "Sigilo Total",
    description: "Ninguém precisa saber. Trabalhe nos bastidores com total discrição e segurança."
  }
];

export const TESTIMONIALS = [
  {
    name: "Fernando S.",
    location: "São Paulo, SP",
    image: "/media/person3.png",
    text: "Maior brisa esse bagulho kkkk. No primeiro mês já lancei vários clientes e isso usando uma modelo só",
    profit: "R$ 16.453,87 no último mês"
  },
  {
    name: "Juliano M.",
    location: "Araruama, RJ",
    image: "https://picsum.photos/id/338/150/150",
    text: "Muito bom, tô usando pra vender no TikTok Shop, muito bom ganhar dinheiro sem precisar aparecer",
    profit: "R$ 3.102,00 em 7 dias"
  },
  {
    name: "Pedro J.",
    location: "São José, SC",
     image: "/media/person1.png",
    text: "Real o melhor método de criação de conteúdo adulto feito por IA do Brasil, tô aprendendo a usar certinho ainda mas vende muito",
    profit: "R$ 5.890,00 em 20 dias"
  }
];

export const FAQ_ITEMS = [
  {
    question: "Preciso ter experiência prévia?",
    answer: "Absolutamente não. Em nosso tutorial, explicamos cada etapa do método Robô do Job de forma super explicativa. Você só precisa de um celular ou computador e acesso à internet."
  },
  {
    question: "Funciona em qualquer celular?",
    answer: "Sim! As ferramentas utilizadas são leves e rodam em qualquer smartphone (Android ou iPhone) com acesso à internet."
  },
  {
    question: "É seguro? É legal?",
    answer: "Totalmente. O método te ensina a criar modelos e influenciadores virtuais feitos e animados por IA. Todas as ferramentas de criação são legítimas e legais."
  },
  {
    question: "E se eu não gostar?",
    answer: "Você tem 7 dias de garantia caso fique insatisfeito com as habilidades de criação de modelos com IA que aprendeu."
  }
];

export const OFFER_PRICE = {
  original: "689,90",
  current: "147,00",
  installments: "12x de R$ 14,76"
};