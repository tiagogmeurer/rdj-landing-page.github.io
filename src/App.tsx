import React from "react";
import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Afiliados from "./pages/Afiliados";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/afiliados" element={<Afiliados />} />
    </Routes>
  );
};

export default App;
