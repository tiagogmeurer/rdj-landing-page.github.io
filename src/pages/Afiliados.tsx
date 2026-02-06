import React from "react";
import Button from "../components/Button";
import { ShieldCheck, ArrowRight, Zap, Users, BadgeCheck } from "lucide-react";

const Afiliados: React.FC = () => {
  const goToKirvanoAffiliate = () => {
    // Troque pela URL real do programa de afiliados na Kirvano
    window.location.href = "https://app.kirvano.com/affiliate/2af98d78-259d-4b6d-b0f7-8e276af94836";
  };

  return (
    <div className="min-h-screen bg-brand-dark text-white px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <div className="inline-block mb-4 px-4 py-1 border border-brand-pink/50 rounded-full bg-brand-pink/10 backdrop-blur-sm">
            <span className="text-brand-pink text-xs md:text-sm font-bold tracking-widest uppercase">
              Programa Oficial • 2026
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-extrabold leading-tight mb-4">
            Seja um Afiliado Fundador do <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-pink to-white text-glow">
              Robô do Job
            </span>
          </h1>

          <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto">
            Ganhe comissões de até 45% divulgando o método que está explodindo no Brasil.
            Você recebe acesso + materiais prontos + link de afiliado.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="glass-effect p-6 rounded-2xl border border-brand-pink/20">
            <Users className="w-8 h-8 text-brand-pink mb-3" />
            <h3 className="text-xl font-bold mb-2">Comissão Alta</h3>
            <p className="text-sm text-gray-400">Ganhe por cada venda. Sem estoque, sem suporte, sem entrega.</p>
          </div>

          <div className="glass-effect p-6 rounded-2xl border border-brand-pink/20">
            <Zap className="w-8 h-8 text-brand-pink mb-3" />
            <h3 className="text-xl font-bold mb-2">Venda no Automático</h3>
            <p className="text-sm text-gray-400">Use meus criativos, copys e estrutura pronta pra converter rápido.</p>
          </div>

          <div className="glass-effect p-6 rounded-2xl border border-brand-pink/20">
            <BadgeCheck className="w-8 h-8 text-brand-pink mb-3" />
            <h3 className="text-xl font-bold mb-2">Produto Quente</h3>
            <p className="text-sm text-gray-400">Oferta simples, desejo alto e compra discreta.</p>
          </div>
        </div>

        <div className="glass-effect p-8 rounded-3xl border border-brand-pink/30 text-center shadow-[0_0_60px_rgba(255,0,127,0.12)]">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">
            Clique e entre agora no programa
          </h2>
          <p className="text-gray-300 mb-6">
            Você será direcionado para a página oficial de afiliação (Kirvano).
          </p>

          <Button onClick={goToKirvanoAffiliate} className="w-full md:w-auto min-w-[320px] text-xl">
            QUERO SER AFILIADO AGORA <ArrowRight className="inline w-5 h-5 ml-2" />
          </Button>

          <p className="mt-4 text-xs text-gray-500 uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" /> Cadastro rápido • link instantâneo
          </p>
        </div>

        <div className="text-center mt-10">
          <a href="/" className="text-brand-pink hover:underline text-sm">
            ← Voltar para a página principal
          </a>
        </div>
      </div>
    </div>
  );
};

export default Afiliados;
