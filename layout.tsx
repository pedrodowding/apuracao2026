import React from 'react';
import './style.css';
export const metadata={title:'Apuração Brasil 2026',description:'Painel independente de acompanhamento da apuração eleitoral com fonte TSE'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
