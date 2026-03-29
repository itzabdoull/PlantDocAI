import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Camera, Upload, RefreshCw, Leaf, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface PlantCareTips {
  watering: string;
  sunlight: string;
  soil: string;
  fertilization: string;
}

interface PlantAnalysis {
  plantName: string;
  diseaseFound: boolean;
  diseaseName?: string;
  confidence: number;
  symptoms: string[];
  organicSolution: string;
  chemicalSolution: string;
  prevention: string[];
  careTips: PlantCareTips;
}

interface JournalEntry {
  id: string;
  date: string;
  plantName: string;
  diseaseName: string;
  solutionApplied: string;
  notes: string;
  image?: string;
}

// --- Gemini Service ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const analyzePlantImage = async (base64Data: string): Promise<PlantAnalysis> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this image of a plant. Identify the plant species and check for any signs of disease, pests, or nutrient deficiencies.
  If a disease or issue is found, provide a detailed diagnosis.
  Provide BOTH organic and chemical treatment solutions.
  Also provide general care tips for this specific plant type (watering, sunlight, soil, fertilization).
  
  Return the response in JSON format with the following structure:
  {
    "plantName": "Common and scientific name",
    "diseaseFound": boolean,
    "diseaseName": "Name of disease if found, otherwise 'Healthy'",
    "confidence": 0.0 to 1.0,
    "symptoms": ["list of observed symptoms"],
    "organicSolution": "Detailed organic treatment steps",
    "chemicalSolution": "Detailed chemical treatment steps",
    "prevention": ["list of prevention tips"],
    "careTips": {
      "watering": "advice",
      "sunlight": "advice",
      "soil": "advice",
      "fertilization": "advice"
    }
  }`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data.split(',')[1]
          }
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plantName: { type: Type.STRING },
          diseaseFound: { type: Type.BOOLEAN },
          diseaseName: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
          organicSolution: { type: Type.STRING },
          chemicalSolution: { type: Type.STRING },
          prevention: { type: Type.ARRAY, items: { type: Type.STRING } },
          careTips: {
            type: Type.OBJECT,
            properties: {
              watering: { type: Type.STRING },
              sunlight: { type: Type.STRING },
              soil: { type: Type.STRING },
              fertilization: { type: Type.STRING }
            },
            required: ["watering", "sunlight", "soil", "fertilization"]
          }
        },
        required: ["plantName", "diseaseFound", "confidence", "symptoms", "organicSolution", "chemicalSolution", "prevention", "careTips"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as PlantAnalysis;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("Could not analyze the image properly. Please try again.");
  }
};

// --- Constants ---

const COMMON_DISEASES = [
  {
    name: "Late Blight (Phytophthora infestans)",
    type: "Vegetable (Tomato/Potato)",
    symptoms: ["Dark, water-soaked spots on leaves", "White mold on leaf undersides", "Rotting fruit/tubers"],
    cause: "Oomycete pathogen thriving in cool, wet conditions.",
    organic: "Remove infected plants, use copper-based fungicides, ensure good air circulation.",
    chemical: "Chlorothalonil or Mancozeb sprays applied before infection spreads."
  },
  {
    name: "Powdery Mildew",
    type: "Ornamental/Vegetable",
    symptoms: ["White, flour-like spots on leaves and stems", "Curling leaves", "Stunted growth"],
    cause: "Fungal spores spread by wind in high humidity.",
    organic: "Neem oil, baking soda spray (1 tsp per quart of water), or milk spray.",
    chemical: "Sulfur-based fungicides or Myclobutanil."
  },
  {
    name: "Black Spot",
    type: "Ornamental (Roses)",
    symptoms: ["Circular black spots on leaves", "Yellowing leaves", "Premature leaf drop"],
    cause: "Diplocarpon rosae fungus, spreads via water splashes.",
    organic: "Prune infected leaves, apply neem oil, use mulch to prevent soil splashing.",
    chemical: "Fungicides containing Triforine or Chlorothalonil."
  },
  {
    name: "Citrus Canker",
    type: "Fruit (Citrus)",
    symptoms: ["Raised, crater-like lesions on leaves and fruit", "Yellow halos around lesions"],
    cause: "Xanthomonas bacteria spread by wind and rain.",
    organic: "Prune infected branches, use copper-based sprays, sanitize tools.",
    chemical: "Preventative copper-based bactericides."
  },
  {
    name: "Downy Mildew",
    type: "Vegetable (Cucurbits/Grapes)",
    symptoms: ["Yellow angular spots on upper leaf surfaces", "Purple/gray fuzz on leaf undersides"],
    cause: "Pseudoperonospora cubensis, thrives in cool, moist environments.",
    organic: "Improve drainage, avoid overhead watering, use copper sprays.",
    chemical: "Fungicides like Mancozeb or Ridomil Gold."
  },
  {
    name: "Apple Scab",
    type: "Fruit (Apples/Pears)",
    symptoms: ["Olive-green to black velvety spots on leaves", "Scabby lesions on fruit"],
    cause: "Venturia inaequalis fungus, overwinters in fallen leaves.",
    organic: "Rake and destroy fallen leaves, prune for airflow, use sulfur sprays.",
    chemical: "Captan or Myclobutanil applied at bud break."
  },
  {
    name: "Fusarium Wilt",
    type: "Vegetable (Tomato/Pepper)",
    symptoms: ["Yellowing of lower leaves", "Wilting during the day", "Brown discoloration inside stems"],
    cause: "Soil-borne fungus Fusarium oxysporum.",
    organic: "Use resistant varieties, rotate crops, solarize soil.",
    chemical: "Soil fumigants (usually for commercial use only)."
  },
  {
    name: "Rust",
    type: "Ornamental/Vegetable",
    symptoms: ["Orange, yellow, or brown pustules on leaf undersides", "Stunted growth"],
    cause: "Various Puccinia fungi, requires moisture to infect.",
    organic: "Remove infected leaves, avoid wetting foliage, use sulfur dust.",
    chemical: "Fungicides containing Myclobutanil or Tebuconazole."
  },
  {
    name: "Bacterial Leaf Spot",
    type: "Vegetable (Peppers/Leafy Greens)",
    symptoms: ["Small, dark water-soaked spots", "Spots turn brown and papery", "Leaf drop"],
    cause: "Xanthomonas bacteria, often seed-borne.",
    organic: "Use certified disease-free seeds, copper sprays, crop rotation.",
    chemical: "Streptomycin or copper-based bactericides."
  },
  {
    name: "Root Rot",
    type: "All Types",
    symptoms: ["Yellowing leaves", "Wilting despite wet soil", "Mushy, brown/black roots"],
    cause: "Overwatering and poor drainage leading to Pythium or Phytophthora.",
    organic: "Improve drainage, let soil dry between waterings, use beneficial microbes (Trichoderma).",
    chemical: "Fungicides like Etridiazole (limited effectiveness once severe)."
  }
];

// --- Components ---

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PlantAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'journal' | 'about'>('home');
  const [journal, setJournal] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem('plant_journal');
    return saved ? JSON.parse(saved) : [];
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    localStorage.setItem('plant_journal', JSON.stringify(journal));
  }, [journal]);

  const addToJournal = () => {
    if (!result) return;
    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      plantName: result.plantName,
      diseaseName: result.diseaseName || 'Healthy',
      solutionApplied: result.organicSolution, // Default to organic for the log
      notes: '',
      image: image || undefined
    };
    setJournal([newEntry, ...journal]);
    setActiveTab('journal');
  };

  const deleteJournalEntry = (id: string) => {
    setJournal(journal.filter(entry => entry.id !== id));
  };

  // Camera handling
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setError(null);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions or upload a photo instead.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
        handleAnalyze(dataUrl);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImage(dataUrl);
        handleAnalyze(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async (imageData: string) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const analysis = await analyzePlantImage(imageData);
      setResult(analysis);
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setIsCameraActive(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <header className="w-full max-w-2xl mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Leaf className="text-olive-dark w-8 h-8" />
          <h1 className="serif text-4xl font-light text-olive-dark tracking-tight">PlantDoc AI</h1>
        </div>
        <p className="text-gray-600 font-light">Identify plant health issues in seconds</p>
        
        {/* Navigation */}
        <nav className="flex justify-center gap-4 mt-6">
          <button 
            onClick={() => { setActiveTab('home'); reset(); }}
            className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", activeTab === 'home' ? "bg-olive-dark text-white" : "text-gray-500 hover:bg-gray-100")}
          >
            Home
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", activeTab === 'library' ? "bg-olive-dark text-white" : "text-gray-500 hover:bg-gray-100")}
          >
            Library
          </button>
          <button 
            onClick={() => setActiveTab('journal')}
            className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", activeTab === 'journal' ? "bg-olive-dark text-white" : "text-gray-500 hover:bg-gray-100")}
          >
            Journal
          </button>
          <button 
            onClick={() => setActiveTab('about')}
            className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", activeTab === 'about' ? "bg-olive-dark text-white" : "text-gray-500 hover:bg-gray-100")}
          >
            About
          </button>
        </nav>
      </header>

      <main className="w-full max-w-2xl">
        {activeTab === 'home' && (
          <>
            {/* About Section */}
            {!image && !isCameraActive && !isAnalyzing && (
              <div className="mb-8 p-6 bg-white/50 rounded-3xl border border-gray-100 text-center">
                <h2 className="serif text-xl mb-2 text-olive-dark">How it works</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  PlantDoc AI uses advanced computer vision to diagnose plant diseases from a single photo. 
                  Simply snap a picture of your plant's leaves, and we'll provide a diagnosis, 
                  organic and chemical solutions, and tailored care tips to help your garden thrive.
                </p>
              </div>
            )}

            {/* Main Action Area */}
            {!image && !isCameraActive && (
              <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col items-center gap-6">
                <div className="w-24 h-24 bg-warm-off-white rounded-full flex items-center justify-center text-olive-dark">
                  <Camera size={40} />
                </div>
                <div className="text-center">
                  <h2 className="serif text-2xl mb-2">Check your plant</h2>
                  <p className="text-gray-500 text-sm max-w-xs">Take a clear photo of the affected leaves or stems for the best results.</p>
                </div>
                
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={startCamera}
                    className="w-full bg-olive-dark text-white rounded-full py-4 px-6 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity font-medium"
                  >
                    <Camera size={20} />
                    Snap a Photo
                  </button>
                  
                  <label className="w-full border border-gray-200 text-gray-700 rounded-full py-4 px-6 flex items-center justify-center gap-2 hover:bg-gray-50 cursor-pointer transition-colors font-medium">
                    <Upload size={20} />
                    Upload from Gallery
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            )}

            {/* Camera View */}
            {isCameraActive && (
              <div className="relative bg-black rounded-[32px] overflow-hidden aspect-[3/4] shadow-2xl">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8">
                  <button 
                    onClick={stopCamera}
                    className="w-12 h-12 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <X size={24} />
                  </button>
                  <button 
                    onClick={capturePhoto}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <div className="w-16 h-16 border-2 border-olive-dark rounded-full" />
                  </button>
                  <div className="w-12 h-12" /> {/* Spacer for balance */}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isAnalyzing && (
              <div className="bg-white rounded-[32px] p-12 shadow-sm border border-gray-100 flex flex-col items-center gap-6 animate-pulse">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-gray-100 border-t-olive-dark rounded-full animate-spin" />
                  <Leaf className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-olive-dark w-8 h-8" />
                </div>
                <div className="text-center">
                  <h2 className="serif text-2xl mb-2">Analyzing...</h2>
                  <p className="text-gray-500 text-sm">Our AI is examining your plant's health</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 rounded-[32px] p-8 border border-red-100 flex flex-col items-center gap-4">
                <AlertCircle className="text-red-500 w-12 h-12" />
                <div className="text-center">
                  <h2 className="serif text-xl text-red-800 mb-1">Something went wrong</h2>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
                <button 
                  onClick={reset}
                  className="bg-red-100 text-red-800 px-6 py-2 rounded-full text-sm font-medium hover:bg-red-200 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Result State */}
            {result && image && !isAnalyzing && (
              <div className="space-y-6">
                {/* Captured Image Preview */}
                <div className="relative rounded-[32px] overflow-hidden aspect-video shadow-sm border border-gray-100">
                  <img src={image} alt="Captured plant" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={reset}
                    className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full text-gray-700 hover:bg-white transition-colors"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>

                {/* Analysis Card */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 space-y-8">
                  {/* Header Info */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h2 className="serif text-3xl text-olive-dark mb-1">{result.plantName}</h2>
                      <div className="flex items-center gap-2">
                        {result.diseaseFound ? (
                          <span className="bg-orange-100 text-orange-800 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                            <AlertCircle size={12} />
                            {result.diseaseName}
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                            <CheckCircle size={12} />
                            Healthy
                          </span>
                        )}
                        <span className="text-gray-400 text-xs font-medium">
                          {Math.round(result.confidence * 100)}% Confidence
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={addToJournal}
                      className="text-olive-dark text-xs font-bold uppercase tracking-widest hover:underline"
                    >
                      Save to Journal
                    </button>
                  </div>

                  {/* Symptoms */}
                  {result.symptoms.length > 0 && (
                    <section>
                      <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3 flex items-center gap-2">
                        <Info size={14} />
                        Observations
                      </h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {result.symptoms.map((symptom, i) => (
                          <li key={i} className="text-sm text-gray-600 bg-warm-off-white/50 px-4 py-2 rounded-xl border border-gray-50">
                            {symptom}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Care Tips Feature */}
                  <section className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                    <h3 className="text-xs uppercase tracking-widest text-blue-600 font-bold mb-4 flex items-center gap-2">
                      <Leaf size={14} />
                      General Care Tips
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-blue-400">Watering</span>
                        <p className="text-xs text-gray-600">{result.careTips.watering}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-blue-400">Sunlight</span>
                        <p className="text-xs text-gray-600">{result.careTips.sunlight}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-blue-400">Soil</span>
                        <p className="text-xs text-gray-600">{result.careTips.soil}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-blue-400">Fertilization</span>
                        <p className="text-xs text-gray-600">{result.careTips.fertilization}</p>
                      </div>
                    </div>
                  </section>

                  {/* Solutions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <section className="bg-olive-dark/5 p-6 rounded-3xl border border-olive-dark/10">
                      <h3 className="text-xs uppercase tracking-widest text-olive-dark font-bold mb-3 flex items-center gap-2">
                        <Leaf size={14} />
                        Organic Solution
                      </h3>
                      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed text-xs">
                        <ReactMarkdown>{result.organicSolution}</ReactMarkdown>
                      </div>
                    </section>

                    <section className="bg-red-50/50 p-6 rounded-3xl border border-red-100">
                      <h3 className="text-xs uppercase tracking-widest text-red-600 font-bold mb-3 flex items-center gap-2">
                        <AlertCircle size={14} />
                        Chemical Solution
                      </h3>
                      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed text-xs">
                        <ReactMarkdown>{result.chemicalSolution}</ReactMarkdown>
                      </div>
                    </section>
                  </div>

                  {/* Prevention */}
                  {result.prevention.length > 0 && (
                    <section>
                      <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-3 flex items-center gap-2">
                        <CheckCircle size={14} />
                        Prevention Tips
                      </h3>
                      <ul className="space-y-2">
                        {result.prevention.map((tip, i) => (
                          <li key={i} className="text-sm text-gray-600 flex gap-3">
                            <span className="text-olive-dark font-bold">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <button 
                    onClick={reset}
                    className="w-full border border-olive-dark text-olive-dark rounded-full py-4 px-6 flex items-center justify-center gap-2 hover:bg-olive-dark/5 transition-colors font-medium"
                  >
                    Scan Another Plant
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'library' && (
          <div className="space-y-6">
            <h2 className="serif text-3xl text-olive-dark text-center mb-8">Disease Library</h2>
            <div className="grid grid-cols-1 gap-6">
              {COMMON_DISEASES.map((disease, i) => (
                <div key={i} className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="serif text-2xl text-olive-dark">{disease.name}</h3>
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{disease.type}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-1">Symptoms</h4>
                      <p className="text-sm text-gray-600">{disease.symptoms.join(', ')}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-1">Cause</h4>
                      <p className="text-sm text-gray-600">{disease.cause}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-olive-dark mb-1">Organic Treatment</h4>
                        <p className="text-xs text-gray-600 italic">{disease.organic}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] uppercase font-bold text-red-600 mb-1">Chemical Treatment</h4>
                        <p className="text-xs text-gray-600 italic">{disease.chemical}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="space-y-6">
            <h2 className="serif text-3xl text-olive-dark text-center mb-8">Treatment Journal</h2>
            
            {journal.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-gray-200">
                <Leaf className="mx-auto text-gray-200 w-16 h-16 mb-4" />
                <p className="text-gray-400">Your journal is empty. Scan a plant to start logging treatments.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {journal.map((entry) => (
                  <div key={entry.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 flex flex-col md:flex-row">
                    {entry.image && (
                      <div className="w-full md:w-48 h-48 md:h-auto overflow-hidden">
                        <img src={entry.image} alt={entry.plantName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{entry.date}</span>
                          <button 
                            onClick={() => deleteJournalEntry(entry.id)}
                            className="text-red-300 hover:text-red-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <h3 className="serif text-xl text-olive-dark mb-1">{entry.plantName}</h3>
                        <p className="text-sm font-semibold text-orange-600 mb-3">{entry.diseaseName}</p>
                        
                        <div className="bg-warm-off-white/50 p-4 rounded-2xl border border-gray-50 mb-4">
                          <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-1">Treatment Applied</h4>
                          <p className="text-xs text-gray-600 line-clamp-3">{entry.solutionApplied}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                        <Info size={12} />
                        <span>Recovery in progress...</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-12 pb-12">
            <section className="text-center">
              <h2 className="serif text-4xl text-olive-dark mb-4">Our Mission</h2>
              <p className="text-gray-600 leading-relaxed max-w-xl mx-auto">
                PlantDoc AI was born from a simple belief: every gardener deserves an expert by their side. 
                Our mission is to empower plant lovers—from balcony beginners to seasoned horticulturalists—with 
                the tools they need to grow healthy, thriving gardens using the power of artificial intelligence.
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                <h3 className="serif text-2xl text-olive-dark mb-4">The Technology</h3>
                <div className="space-y-4 text-sm text-gray-600">
                  <p>
                    At the heart of PlantDoc AI is <strong>Gemini 3 Flash</strong>, a state-of-the-art multimodal model 
                    capable of sophisticated visual reasoning.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex gap-2">
                      <CheckCircle size={16} className="text-olive-dark shrink-0" />
                      <span><strong>Computer Vision:</strong> Analyzes leaf patterns, color shifts, and pest signatures.</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle size={16} className="text-olive-dark shrink-0" />
                      <span><strong>Expert Knowledge:</strong> Accesses a vast database of botanical research and treatment protocols.</span>
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle size={16} className="text-olive-dark shrink-0" />
                      <span><strong>Real-time Processing:</strong> Delivers diagnoses in seconds, not days.</span>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
                <h3 className="serif text-2xl text-olive-dark mb-4">The Team</h3>
                <div className="space-y-4 text-sm text-gray-600">
                  <p>
                    We are a collective of developers, designers, and plant enthusiasts dedicated to bridging 
                    the gap between technology and nature.
                  </p>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <h4 className="font-bold text-olive-dark">Engineering</h4>
                      <p className="text-xs">Building robust AI pipelines and intuitive interfaces.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-olive-dark">Horticulture</h4>
                      <p className="text-xs">Ensuring our treatment advice is safe and effective.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-olive-dark">Design</h4>
                      <p className="text-xs">Creating a calm, organic experience for our users.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-olive-dark">Community</h4>
                      <p className="text-xs">Listening to gardeners to build the features they need.</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="bg-olive-dark text-white rounded-[32px] p-10 text-center">
              <h3 className="serif text-3xl mb-4">Join the Green Revolution</h3>
              <p className="text-white/80 mb-6 max-w-md mx-auto">
                Whether you're treating a single houseplant or a full vegetable patch, 
                PlantDoc AI is here to help you grow.
              </p>
              <button 
                onClick={() => setActiveTab('home')}
                className="bg-white text-olive-dark px-8 py-3 rounded-full font-bold hover:bg-warm-off-white transition-colors"
              >
                Start Scanning
              </button>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-gray-400 text-xs">
        <p>© 2026 PlantDoc AI • Powered by Gemini</p>
      </footer>

      {/* Hidden Canvas for Capturing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
