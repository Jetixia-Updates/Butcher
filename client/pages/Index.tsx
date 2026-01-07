import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Info } from "lucide-react";
export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-serif font-bold tracking-tight text-slate-900 sm:text-5xl">
            New UAE Dirham Symbol
          </h1>
          <p className="text-lg text-slate-600">
            Announced by the Central Bank of the UAE in March 2025
          </p>
        </div>
        <Card className="bg-white shadow-xl border-slate-200 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-600 via-slate-800 to-red-600" />
          
          <CardContent className="flex flex-col items-center justify-center pt-12 pb-12 min-h-[300px]">
            <div className="w-48 h-48 flex items-center justify-center mb-6 relative group">
              <div className="absolute inset-0 bg-emerald-50 rounded-full scale-0 group-hover:scale-110 transition-transform duration-500 ease-out opacity-50" />
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/e/ee/UAE_Dirham_Symbol.svg" 
                alt="New UAE Dirham Symbol" 
                className="w-40 h-40 object-contain relative z-10 drop-shadow-lg"
              />
            </div>
            
            <div className="text-center space-y-4 max-w-md mx-auto">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 mb-1 uppercase tracking-wider font-semibold">Description</p>
                <p className="text-slate-700">
                  A Latin letter <span className="font-bold">D</span> crossed with two horizontal lines, inspired by the UAE flag and Arabic calligraphy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-600" />
                Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm leading-relaxed">
                The symbol is placed <strong>before</strong> the numeral (e.g., <span className="font-serif font-bold text-slate-800">₫ 100</span>). It is designed to align with global currency standards while reflecting national identity.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-slate-600" />
                Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm mb-4">
                Sourced directly from Wikipedia as requested.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href="https://en.wikipedia.org/wiki/United_Arab_Emirates_dirham" target="_blank" rel="noreferrer">
                  View on Wikipedia
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
