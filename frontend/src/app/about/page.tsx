import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'எங்களைப் பற்றி | ஊரும் உறவும்',
  description: 'ஊரும் உறவும் தமிழ் செய்தி தளம் பற்றிய தகவல்கள்',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">எங்களைப் பற்றி</h1>
      <div className="prose prose-lg max-w-none">
        <p>
          ஊரும் உறவும் என்பது தமிழ் மக்களுக்கான ஒரு நவீன செய்தி தளமாகும்.
          அரசியல், விளையாட்டு, உள்ளூர் செய்திகள், உலக செய்திகள் மற்றும்
          பலவற்றை உள்ளடக்கிய செய்திகளை நாங்கள் வழங்குகிறோம்.
        </p>
        <p>
          எங்கள் நோக்கம் தமிழ் மக்களுக்கு நம்பகமான, துல்லியமான மற்றும்
          சமீபத்திய செய்திகளை வழங்குவதாகும்.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">எங்கள் பணி</h2>
        <p>
          தரமான பத்திரிகையியல் மூலம் தமிழ் சமூகத்திற்கு சேவை செய்வது
          எங்கள் முதன்மை பணியாகும்.
        </p>
      </div>
    </div>
  );
}
