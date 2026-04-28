import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'விதிமுறைகள் | ஊரும் உறவும்',
  description: 'ஊரும் உறவும் பயன்பாட்டு விதிமுறைகள்',
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">பயன்பாட்டு விதிமுறைகள்</h1>
      <div className="prose prose-lg max-w-none">
        <p>
          ஊரும் உறவும் தளத்தைப் பயன்படுத்துவதன் மூலம், நீங்கள் இந்த
          விதிமுறைகளை ஏற்றுக்கொள்கிறீர்கள்.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">பயன்பாட்டு உரிமை</h2>
        <p>
          இந்த தளத்தில் உள்ள உள்ளடக்கம் தனிப்பட்ட, வணிகரீதியற்ற
          பயன்பாட்டிற்கு மட்டுமே. எழுத்தாளர்களின் அனுமதியின்றி
          உள்ளடக்கத்தை மறுபிரசுரம் செய்ய இயலாது.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">கருத்துகள்</h2>
        <p>
          பயனர்கள் பொறுப்பான கருத்துகளை மட்டுமே பதிவிட வேண்டும்.
          அவதூறான அல்லது தவறான கருத்துகள் அகற்றப்படும்.
        </p>
      </div>
    </div>
  );
}
