import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'தனியுரிமைக் கொள்கை | ஊரும் உறவும்',
  description: 'ஊரும் உறவும் தனியுரிமைக் கொள்கை',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">தனியுரிமைக் கொள்கை</h1>
      <div className="prose prose-lg max-w-none">
        <p>
          ஊரும் உறவும் உங்கள் தனியுரிமையை மதிக்கிறது. இந்தக் கொள்கை
          எங்கள் தளத்தில் சேகரிக்கப்படும் தகவல்கள் மற்றும் அவற்றின்
          பயன்பாடு பற்றி விளக்குகிறது.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">தகவல் சேகரிப்பு</h2>
        <p>
          எங்கள் தளத்தைப் பயன்படுத்தும்போது, உலாவி வகை, வருகை நேரம்
          போன்ற அடிப்படை தகவல்கள் தானாகவே சேகரிக்கப்படும்.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">குக்கீகள்</h2>
        <p>
          எங்கள் தளம் சிறந்த அனுபவத்தை வழங்க குக்கீகளைப் பயன்படுத்துகிறது.
        </p>
      </div>
    </div>
  );
}
