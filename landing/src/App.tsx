import { Audiences } from './components/Audiences';
import { Faq } from './components/Faq';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Plans } from './components/Plans';
import { Signup } from './components/Signup';
// Sección de deportes oculta por ahora; para volver a mostrarla, descomenta esto y <Sports />.
// import { Sports } from './components/Sports';
import { Steps } from './components/Steps';
import { Ventas } from './components/Ventas';

export function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        {/* <Sports /> */}
        <Steps />
        <Audiences />
        <Features />
        <Ventas />
        <Plans />
        <Signup />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
