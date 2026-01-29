import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <main className="flex-1 flex flex-col items-center py-12 px-6 md:px-20 max-w-7xl mx-auto w-full">
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="relative group">
            <div className="absolute -inset-2 bg-nord7/10 blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative aspect-square w-64 md:w-full max-w-xs bg-deep-search border-2 border-nord3/60 rounded-lg overflow-hidden shadow-2xl">
              <img alt="Cybersecurity profile" className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-500" src="/images/stark.webp"/>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="px-4 py-1.5 bg-nord1 border border-nord3/60 text-nord14 text-[10px] font-black uppercase mb-3 tracking-[0.3em] rounded-full">
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-nord14 mr-2"></span> Clearance: Omega
            </div>
            <h2 className="text-3xl font-bold nord-glow text-nord6">Stark</h2>
          </div>
        </div>
        <div className="lg:col-span-8 flex flex-col gap-10">
          <div className="bg-nord1/50 border border-nord3 p-8 rounded-2xl relative backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono mb-8">
              <div className="space-y-2">
                <p className="text-nord9 text-xs flex justify-between border-b border-nord3/30 pb-1">Login: <span className="text-nord5">root</span></p>
                <p className="text-nord9 text-xs flex justify-between border-b border-nord3/30 pb-1">Directory: <span className="text-nord5">/home/stark</span></p>
              </div>
              <div className="space-y-2">
                <p className="text-nord9 text-xs flex justify-between border-b border-nord3/30 pb-1">Status: <span className="text-nord14">Active</span></p>
                <p className="text-nord9 text-xs flex justify-between border-b border-nord3/30 pb-1">Shell: <span className="text-nord10">/bin/zsh</span></p>
              </div>
            </div>
            <div className="space-y-6">
              <h3 className="text-nord8 font-bold text-xs uppercase tracking-[0.4em] flex items-center gap-2">
                <span className="w-2 h-2 bg-nord8"></span> WHOAMI
              </h3>
              <p className="text-sm leading-relaxed text-nord4 opacity-90 first-letter:text-2xl first-letter:font-bold first-letter:text-nord8">
              No busco atajos ni fama. Busco entender la raíz del sistema, porque solo quien comprende lo invisible puede dominar lo imposible.
              </p>
            </div>
          </div>
          <div className="bg-nord1/30 border border-nord3/60 p-8 rounded-2xl">
            <h3 className="text-nord7 font-bold text-xs uppercase tracking-[0.4em] mb-8">SKILLSET_LEVELS</h3>
            <div className="space-y-8">
              {['Networking', 'Scripting', 'Cloud Pwn'].map((skill, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-[10px] font-bold text-nord5 uppercase tracking-widest">{skill}</span>
                    <span className="text-[10px] font-mono text-nord14">{85 - idx*5}%</span>
                  </div>
                  <div className="h-2 w-full bg-deep-search border border-nord3/50 rounded-full overflow-hidden">
                    <div className="h-full bg-nord14 shadow-[0_0_15px_rgba(163,190,140,0.4)]" style={{width: `${85 - idx*5}%`}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AboutPage;
