import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'தொடர்பு கொள்ள | ஊரும் உறவும்',
  description: 'ஊரும் உறவும் செய்தி தளத்தை தொடர்பு கொள்ளுங்கள்',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">தொடர்பு கொள்ள</h1>
      <div className="prose prose-lg max-w-none">
        <p>
          எங்களை தொடர்பு கொள்ள கீழே உள்ள தகவல்களைப் பயன்படுத்தவும்.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">மின்னஞ்சல்</h2>
        <p>contact@oorumuravum.today</p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">சமூக ஊடகங்கள்</h2>
        <ul>
          <li>Facebook: @oorumuravum</li>
          <li>Twitter: @oorumuravum</li>
          <li>Instagram: @oorumuravum</li>
        </ul>
      </div>
    </div>
  );
}
