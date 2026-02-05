import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Star, Zap, Smartphone, Volume2, VolumeX } from 'lucide-react';
import Button from '../components/Button';
import AccordionItem from '../components/Accordion';
import { BENEFITS, TESTIMONIALS, FAQ_ITEMS, OFFER_PRICE } from '../constants';

const RECOVER_URL = 'https://app.robodojob.com/acessar#/';
const KIRVANO_CHECKOUT_URL = 'https://pay.kirvano.com/d7a4f61a-b0e1-40ff-86ed-b23202a3380d';

const Home: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 14, seconds: 59 });

  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 };
        clearInterval(timer);
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const scrollToCheckout = () => {
    const element = document.getElementById('offer');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const goToCheckout = () => {
    window.location.href = KIRVANO_CHECKOUT_URL;
  };

  const toggleSound = () => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return (
    <div className="min-h-screen font-sans bg-brand-dark text-white selection:bg-brand-pink selection:text-white overflow-x-hidden">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-brand-accent to-brand-pink text-white text-center py-2 px-4 text-xs md:text-sm font-bold tracking-widest uppercase">
        <span className="animate-pulse">⚠️ Atenção: Acesso liberado por tempo limitado</span>
      </div>

      {/* Hero */}
      <header className="relative pt-12 pb-20 px-4 md:pt-20 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-pink/20 rounded-full blur-[120px] -z-10 opacity-60"></div>

        {/* ✅ Acessar no topo */}
        <div className="absolute top-4 right-4 z-20">
          <a
            href={RECOVER_URL}
            className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white/90 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
            rel="noreferrer"
          >
            Acessar
          </a>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block mb-6 px-4 py-1 border border-brand-pink/50 rounded-full bg-brand-pink/10 backdrop-blur-sm">
            <span className="text-brand-pink text-xs md:text-sm font-bold tracking-widest uppercase">
              Método Secreto • Atualizado 2026
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-extrabold leading-tight mb-6">
            Robô do Job: <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-pink to-white text-glow">
              Renda Automática
            </span>
            <br /> Enquanto Você Dorme
          </h1>

          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            <strong>Descubra</strong> como empreendedores internacionais estão faturando alto online sem aparecer.
          </p>

          {/* VSL */}
          <div
            className="relative w-full aspect-video max-w-3xl mx-auto bg-brand-card rounded-2xl border border-brand-pink/30 shadow-[0_0_50px_rgba(255,0,127,0.2)] overflow-hidden mb-10 cursor-pointer"
            onClick={toggleSound}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              src="/media/VSL.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm p-3 rounded-full border border-brand-pink/40 transition-all">
              {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </div>

            {isMuted && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/60 px-6 py-3 rounded-full border border-white/10 text-sm font-semibold animate-pulse">
                  🔊 Clique para ativar o som
                </div>
              </div>
            )}
          </div>

          {/* CTA Hero */}
          <Button onClick={goToCheckout} className="w-full md:w-auto min-w-[300px] text-xl">
            CRIAR ROBÔ DO JOB AGORA!
          </Button>

          <p className="mt-4 text-xs text-gray-500 uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" /> Compra 100% Segura e Discreta
          </p>
        </div>
      </header>

      {/* Benefits */}
      <section className="py-20 bg-black relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Por que a <span className="text-brand-pink">Robô do Job</span> é Diferente?
            </h2>
            <p className="text-gray-400">Lucrar com modelos de IA já uma realidade.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {BENEFITS.map((benefit, index) => (
              <div
                key={index}
                className="glass-effect p-8 rounded-2xl hover:bg-brand-pink/5 transition-all duration-300 group"
              >
                <div className="mb-6 p-3 bg-brand-pink/10 rounded-xl inline-block group-hover:scale-110 transition-transform duration-300">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 font-display">{benefit.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-brand-card border-y border-brand-pink/10">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-12">
            Eles Já Ativaram a <span className="text-brand-pink">Robô do Job</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, index) => (
              <div key={index} className="bg-brand-dark p-6 rounded-2xl border border-gray-800 relative">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full border-2 border-brand-pink object-cover"
                  />
                  <div>
                    <h4 className="font-bold text-sm">{testimonial.name}</h4>
                    <p className="text-xs text-gray-500">{testimonial.location}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-green-500 font-bold flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div> Lucro Verificado
                  </span>
                  <span className="text-brand-pink font-bold text-sm">{testimonial.profit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Offer */}
      <section id="offer" className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-brand-pink/5 to-black pointer-events-none"></div>

        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <div className="glass-effect rounded-3xl p-8 md:p-12 text-center border-brand-pink/30 shadow-[0_0_80px_rgba(255,0,127,0.15)]">
            <div className="inline-block px-4 py-1 bg-brand-pink text-white text-xs font-bold uppercase rounded-full mb-6 animate-pulse">
              Oferta Exclusiva de Lançamento - Vagas Limitadas
            </div>

            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              Acesso Vitalício ao <br />Robô do Job
            </h2>

            <p className="text-gray-400 mb-8">Receba o método completo + Acesso à Comunidade VIP.</p>

            <div className="mb-10">
              <span className="text-gray-500 text-lg line-through block mb-2">De R$ {OFFER_PRICE.original}</span>

              <div className="flex items-center justify-center gap-2 text-brand-pink">
                <span className="text-2xl">Por apenas</span>
                <span className="text-6xl font-bold font-display">
                  {OFFER_PRICE.installments.split('x')[0]}x
                </span>
              </div>

              <div className="text-4xl font-bold text-white mb-2">
                R$ {OFFER_PRICE.installments.split('R$ ')[1]}
              </div>

              <p className="text-sm text-gray-400">ou R$ {OFFER_PRICE.current} à vista</p>
            </div>

            {/* CTA Offer */}
            <Button fullWidth className="text-xl md:text-2xl py-6 mb-4" onClick={goToCheckout}>
              CRIAR MINHA MODELO AGORA
            </Button>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400 border-t border-gray-800 pt-6">
              <div className="flex flex-col items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-brand-pink" />
                <span>Pagamento Seguro</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Zap className="w-6 h-6 text-brand-pink" />
                <span>Acesso Imediato</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-brand-pink" />
                <span>Garantia de 7 Dias</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Smartphone className="w-6 h-6 text-brand-pink" />
                <span>Suporte VIP</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-brand-dark">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-12">Perguntas Frequentes</h2>

          <div className="bg-brand-card rounded-2xl p-6 border border-brand-pink/20">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem key={index} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-10 border-t border-gray-900 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-2xl font-display font-bold text-brand-pink mb-4">ROBÔ DO JOB ®</div>

          <p className="text-gray-600 text-sm mb-6 max-w-lg mx-auto">
            O melhor método de criação de modelos de IA voltadas para o público adulto.
          </p>

          {/* ✅ Botões Footer */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a
              href={RECOVER_URL}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white/90 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
              rel="noreferrer"
            >
              Recuperar acesso
            </a>

            <Link
              to="/afiliados"
              className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-brand-pink/40 bg-brand-pink/10 text-brand-pink text-xs font-bold uppercase tracking-widest hover:bg-brand-pink hover:text-white transition-colors"
            >
              Programa de Afiliados
            </Link>
          </div>

          <p className="mt-8 text-xs text-gray-700">
            © {new Date().getFullYear()} Robô do Job. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
