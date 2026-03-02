// Multilingual error messages for the Smart Crop Advisory app
// Supports: English (en), Kannada (kn), Hindi (hi), Tamil (ta), Telugu (te)

export type Language = 'en' | 'kn' | 'hi' | 'ta' | 'te';

export interface ErrorMessage {
  title: string;
  message: string;
  action?: string;
  guidance?: string;
}

type ErrorMessages = Record<string, Record<Language, ErrorMessage>>;

export const ERROR_MESSAGES: ErrorMessages = {
  // Network errors
  NETWORK_ERROR: {
    en: { title: 'No Internet', message: 'Please check your internet connection and try again.', action: 'Retry', guidance: 'Make sure Wi-Fi or mobile data is enabled.' },
    kn: { title: 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲ', message: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮರುಪ್ರಯತ್ನಿಸಿ', guidance: 'Wi-Fi ಅಥವಾ ಮೊಬೈಲ್ ಡೇಟಾ ಸಕ್ರಿಯವಾಗಿದೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.' },
    hi: { title: 'इंटरनेट नहीं', message: 'कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।', action: 'पुनः प्रयास करें', guidance: 'सुनिश्चित करें कि Wi-Fi या मोबाइल डेटा चालू है।' },
    ta: { title: 'இணையம் இல்லை', message: 'உங்கள் இணைய இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.', action: 'மீண்டும் முயற்சி', guidance: 'Wi-Fi அல்லது மொபைல் டேட்டா இயக்கப்பட்டுள்ளதா என்பதை உறுதிப்படுத்தவும்.' },
    te: { title: 'ఇంటర్నెట్ లేదు', message: 'దయచేసి మీ ఇంటర్నెట్ కనెక్షన్‌ని తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి.', action: 'మళ్ళీ ప్రయత్నించు', guidance: 'Wi-Fi లేదా మొబైల్ డేటా ఆన్ చేయబడిందని నిర్ధారించుకోండి.' },
  },
  
  SERVER_ERROR: {
    en: { title: 'Server Error', message: 'Something went wrong on our end. Please try again later.', action: 'Try Later', guidance: 'Our team has been notified and is working on it.' },
    kn: { title: 'ಸರ್ವರ್ ದೋಷ', message: 'ನಮ್ಮ ಕಡೆಯಿಂದ ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಪ್ರಯತ್ನಿಸಿ.', action: 'ನಂತರ ಪ್ರಯತ್ನಿಸಿ', guidance: 'ನಮ್ಮ ತಂಡಕ್ಕೆ ತಿಳಿಸಲಾಗಿದೆ ಮತ್ತು ಅದರ ಮೇಲೆ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದಾರೆ.' },
    hi: { title: 'सर्वर त्रुटि', message: 'हमारी तरफ से कुछ गलत हो गया। कृपया बाद में पुनः प्रयास करें।', action: 'बाद में प्रयास करें', guidance: 'हमारी टीम को सूचित किया गया है और वे इस पर काम कर रहे हैं।' },
    ta: { title: 'சர்வர் பிழை', message: 'எங்கள் பக்கத்தில் ஏதோ தவறு நடந்தது. பின்னர் முயற்சிக்கவும்.', action: 'பின்னர் முயற்சி', guidance: 'எங்கள் குழுவிற்கு தெரிவிக்கப்பட்டது, அவர்கள் இதில் வேலை செய்கிறார்கள்.' },
    te: { title: 'సర్వర్ లోపం', message: 'మా వైపు ఏదో తప్పు జరిగింది. దయచేసి తర్వాత ప్రయత్నించండి.', action: 'తర్వాత ప్రయత్నించు', guidance: 'మా బృందానికి తెలియజేయబడింది మరియు వారు దానిపై పని చేస్తున్నారు.' },
  },
  
  TIMEOUT_ERROR: {
    en: { title: 'Request Timeout', message: 'The request took too long. Please try again.', action: 'Retry', guidance: 'Check your connection speed or try again later.' },
    kn: { title: 'ವಿನಂತಿ ಸಮಯ ಮೀರಿದೆ', message: 'ವಿನಂತಿಗೆ ತುಂಬಾ ಸಮಯ ತೆಗೆದುಕೊಂಡಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮರುಪ್ರಯತ್ನಿಸಿ', guidance: 'ನಿಮ್ಮ ಸಂಪರ್ಕ ವೇಗವನ್ನು ಪರಿಶೀಲಿಸಿ ಅಥವಾ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.' },
    hi: { title: 'अनुरोध समय समाप्त', message: 'अनुरोध में बहुत समय लगा। कृपया पुनः प्रयास करें।', action: 'पुनः प्रयास करें', guidance: 'अपनी कनेक्शन गति जांचें या बाद में प्रयास करें।' },
    ta: { title: 'கோரிக்கை நேரம் முடிந்தது', message: 'கோரிக்கை அதிக நேரம் எடுத்தது. மீண்டும் முயற்சிக்கவும்.', action: 'மீண்டும் முயற்சி', guidance: 'உங்கள் இணைப்பு வேகத்தை சரிபார்க்கவும் அல்லது பின்னர் முயற்சிக்கவும்.' },
    te: { title: 'అభ్యర్థన సమయం ముగిసింది', message: 'అభ్యర్థనకు చాలా సమయం పట్టింది. దయచేసి మళ్ళీ ప్రయత్నించండి.', action: 'మళ్ళీ ప్రయత్నించు', guidance: 'మీ కనెక్షన్ వేగాన్ని తనిఖీ చేయండి లేదా తర్వాత ప్రయత్నించండి.' },
  },
  
  RATE_LIMIT_ERROR: {
    en: { title: 'Too Many Requests', message: 'You have made too many requests. Please wait a moment.', action: 'Wait', guidance: 'Try again in a few minutes.' },
    kn: { title: 'ಹೆಚ್ಚು ವಿನಂತಿಗಳು', message: 'ನೀವು ಹೆಚ್ಚು ವಿನಂತಿಗಳನ್ನು ಮಾಡಿದ್ದೀರಿ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಕಾಯಿರಿ.', action: 'ಕಾಯಿರಿ', guidance: 'ಕೆಲವು ನಿಮಿಷಗಳಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' },
    hi: { title: 'बहुत सारे अनुरोध', message: 'आपने बहुत सारे अनुरोध किए हैं। कृपया थोड़ा इंतजार करें।', action: 'प्रतीक्षा करें', guidance: 'कुछ मिनटों में पुनः प्रयास करें।' },
    ta: { title: 'அதிக கோரிக்கைகள்', message: 'நீங்கள் அதிக கோரிக்கைகளை செய்துள்ளீர்கள். சிறிது நேரம் காத்திருக்கவும்.', action: 'காத்திரு', guidance: 'சில நிமிடங்களில் மீண்டும் முயற்சிக்கவும்.' },
    te: { title: 'చాలా అభ్యర్థనలు', message: 'మీరు చాలా అభ్యర్థనలు చేసారు. దయచేసి కొంచెం వేచి ఉండండి.', action: 'వేచి ఉండండి', guidance: 'కొన్ని నిమిషాల్లో మళ్ళీ ప్రయత్నించండి.' },
  },

  // Authentication errors
  LOGIN_FAILED: {
    en: { title: 'Login Failed', message: 'Invalid phone number or password. Please try again.', action: 'Try Again', guidance: 'Check your phone number and password are correct.' },
    kn: { title: 'ಲಾಗಿನ್ ವಿಫಲವಾಗಿದೆ', message: 'ಅಮಾನ್ಯ ಫೋನ್ ಸಂಖ್ಯೆ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', guidance: 'ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಸರಿಯಾಗಿದೆಯೇ ಎಂದು ಪರಿಶೀಲಿಸಿ.' },
    hi: { title: 'लॉगिन विफल', message: 'अमान्य फोन नंबर या पासवर्ड। कृपया पुनः प्रयास करें।', action: 'पुनः प्रयास करें', guidance: 'जांचें कि आपका फोन नंबर और पासवर्ड सही है।' },
    ta: { title: 'உள்நுழைவு தோல்வி', message: 'தவறான தொலைபேசி எண் அல்லது கடவுச்சொல். மீண்டும் முயற்சிக்கவும்.', action: 'மீண்டும் முயற்சி', guidance: 'உங்கள் தொலைபேசி எண் மற்றும் கடவுச்சொல் சரியானதா என்று சரிபார்க்கவும்.' },
    te: { title: 'లాగిన్ విఫలమైంది', message: 'చెల్లని ఫోన్ నంబర్ లేదా పాస్‌వర్డ్. దయచేసి మళ్ళీ ప్రయత్నించండి.', action: 'మళ్ళీ ప్రయత్నించు', guidance: 'మీ ఫోన్ నంబర్ మరియు పాస్‌వర్డ్ సరైనవని తనిఖీ చేయండి.' },
  },

  SESSION_EXPIRED: {
    en: { title: 'Session Expired', message: 'Your session has expired. Please login again.', action: 'Login', guidance: 'For your security, sessions expire after 24 hours of inactivity.' },
    kn: { title: 'ಸೆಷನ್ ಮುಗಿದಿದೆ', message: 'ನಿಮ್ಮ ಸೆಷನ್ ಮುಗಿದಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಲಾಗಿನ್ ಮಾಡಿ.', action: 'ಲಾಗಿನ್', guidance: 'ನಿಮ್ಮ ಭದ್ರತೆಗಾಗಿ, 24 ಗಂಟೆಗಳ ನಿಷ್ಕ್ರಿಯತೆಯ ನಂತರ ಸೆಷನ್‌ಗಳು ಮುಗಿಯುತ್ತವೆ.' },
    hi: { title: 'सत्र समाप्त', message: 'आपका सत्र समाप्त हो गया है। कृपया फिर से लॉगिन करें।', action: 'लॉगिन', guidance: 'आपकी सुरक्षा के लिए, 24 घंटे की निष्क्रियता के बाद सत्र समाप्त हो जाते हैं।' },
    ta: { title: 'அமர்வு முடிந்தது', message: 'உங்கள் அமர்வு முடிந்தது. மீண்டும் உள்நுழையவும்.', action: 'உள்நுழை', guidance: 'உங்கள் பாதுகாப்பிற்காக, 24 மணி நேர செயலற்ற நிலைக்குப் பிறகு அமர்வுகள் காலாவதியாகும்.' },
    te: { title: 'సెషన్ ముగిసింది', message: 'మీ సెషన్ ముగిసింది. దయచేసి మళ్ళీ లాగిన్ చేయండి.', action: 'లాగిన్', guidance: 'మీ భద్రత కోసం, 24 గంటల నిష్క్రియత తర్వాత సెషన్‌లు ముగుస్తాయి.' },
  },
  
  REGISTRATION_FAILED: {
    en: { title: 'Registration Failed', message: 'Could not create your account. Please try again.', action: 'Try Again', guidance: 'Make sure all fields are filled correctly.' },
    kn: { title: 'ನೋಂದಣಿ ವಿಫಲವಾಗಿದೆ', message: 'ನಿಮ್ಮ ಖಾತೆಯನ್ನು ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', guidance: 'ಎಲ್ಲಾ ಕ್ಷೇತ್ರಗಳನ್ನು ಸರಿಯಾಗಿ ಭರ್ತಿ ಮಾಡಲಾಗಿದೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.' },
    hi: { title: 'पंजीकरण विफल', message: 'आपका खाता नहीं बनाया जा सका। कृपया पुनः प्रयास करें।', action: 'पुनः प्रयास करें', guidance: 'सुनिश्चित करें कि सभी फ़ील्ड सही ढंग से भरे गए हैं।' },
    ta: { title: 'பதிவு தோல்வி', message: 'உங்கள் கணக்கை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.', action: 'மீண்டும் முயற்சி', guidance: 'அனைத்து புலங்களும் சரியாக நிரப்பப்பட்டுள்ளதா என்பதை உறுதிப்படுத்தவும்.' },
    te: { title: 'నమోదు విఫలమైంది', message: 'మీ ఖాతాను సృష్టించడం సాధ్యం కాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.', action: 'మళ్ళీ ప్రయత్నించు', guidance: 'అన్ని ఫీల్డ్‌లు సరిగ్గా నింపబడ్డాయని నిర్ధారించుకోండి.' },
  },
  
  PHONE_ALREADY_EXISTS: {
    en: { title: 'Phone Number Exists', message: 'This phone number is already registered.', action: 'Login', guidance: 'Try logging in instead, or use a different phone number.' },
    kn: { title: 'ಫೋನ್ ಸಂಖ್ಯೆ ಅಸ್ತಿತ್ವದಲ್ಲಿದೆ', message: 'ಈ ಫೋನ್ ಸಂಖ್ಯೆ ಈಗಾಗಲೇ ನೋಂದಾಯಿಸಲಾಗಿದೆ.', action: 'ಲಾಗಿನ್', guidance: 'ಬದಲಿಗೆ ಲಾಗಿನ್ ಮಾಡಲು ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ ಬೇರೆ ಫೋನ್ ಸಂಖ್ಯೆ ಬಳಸಿ.' },
    hi: { title: 'फोन नंबर मौजूद है', message: 'यह फोन नंबर पहले से पंजीकृत है।', action: 'लॉगिन', guidance: 'इसके बजाय लॉगिन करने का प्रयास करें, या किसी अन्य फोन नंबर का उपयोग करें।' },
    ta: { title: 'தொலைபேசி எண் உள்ளது', message: 'இந்த தொலைபேசி எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது.', action: 'உள்நுழை', guidance: 'அதற்கு பதிலாக உள்நுழைய முயற்சிக்கவும், அல்லது வேறு தொலைபேசி எண்ணைப் பயன்படுத்தவும்.' },
    te: { title: 'ఫోన్ నంబర్ ఉంది', message: 'ఈ ఫోన్ నంబర్ ఇప్పటికే నమోదు చేయబడింది.', action: 'లాగిన్', guidance: 'బదులుగా లాగిన్ చేయడానికి ప్రయత్నించండి, లేదా వేరే ఫోన్ నంబర్ ఉపయోగించండి.' },
  },

  // Feature-specific errors
  IMAGE_UPLOAD_FAILED: {
    en: { title: 'Upload Failed', message: 'Failed to upload image. Please try with a smaller image or check your connection.', action: 'Try Again', guidance: 'Images should be less than 10MB in JPEG or PNG format.' },
    kn: { title: 'ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ', message: 'ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ. ಚಿಕ್ಕ ಚಿತ್ರದೊಂದಿಗೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ', guidance: 'ಚಿತ್ರಗಳು JPEG ಅಥವಾ PNG ಸ್ವರೂಪದಲ್ಲಿ 10MB ಗಿಂತ ಕಡಿಮೆ ಇರಬೇಕು.' },
    hi: { title: 'अपलोड विफल', message: 'छवि अपलोड करने में विफल। कृपया छोटी छवि के साथ प्रयास करें।', action: 'पुनः प्रयास करें', guidance: 'छवियां JPEG या PNG प्रारूप में 10MB से कम होनी चाहिए।' },
    ta: { title: 'பதிவேற்றம் தோல்வி', message: 'படத்தை பதிவேற்ற முடியவில்லை. சிறிய படத்துடன் முயற்சிக்கவும்.', action: 'மீண்டும் முயற்சி', guidance: 'படங்கள் JPEG அல்லது PNG வடிவத்தில் 10MB க்கும் குறைவாக இருக்க வேண்டும்.' },
    te: { title: 'అప్‌లోడ్ విఫలమైంది', message: 'చిత్రాన్ని అప్‌లోడ్ చేయడం విఫలమైంది. చిన్న చిత్రంతో ప్రయత్నించండి.', action: 'మళ్ళీ ప్రయత్నించు', guidance: 'చిత్రాలు JPEG లేదా PNG ఫార్మాట్‌లో 10MB కంటే తక్కువగా ఉండాలి.' },
  },

  LOCATION_PERMISSION_DENIED: {
    en: { title: 'Location Required', message: 'Please enable location access for personalized recommendations.', action: 'Enable' },
    kn: { title: 'ಸ್ಥಳ ಅಗತ್ಯ', message: 'ವೈಯಕ್ತಿಕ ಶಿಫಾರಸುಗಳಿಗಾಗಿ ಸ್ಥಳ ಪ್ರವೇಶವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ.', action: 'ಸಕ್ರಿಯಗೊಳಿಸಿ' },
    hi: { title: 'स्थान आवश्यक', message: 'व्यक्तिगत सिफारिशों के लिए स्थान पहुंच सक्षम करें।', action: 'सक्षम करें' },
    ta: { title: 'இருப்பிடம் தேவை', message: 'தனிப்பயனாக்கப்பட்ட பரிந்துரைகளுக்கு இருப்பிட அணுகலை இயக்கவும்.', action: 'இயக்கு' },
    te: { title: 'స్థానం అవసరం', message: 'వ్యక్తిగతీకరించిన సిఫార్సుల కోసం స్థాన యాక్సెస్‌ను ప్రారంభించండి.', action: 'ప్రారంభించు' },
  },

  CAMERA_PERMISSION_DENIED: {
    en: { title: 'Camera Required', message: 'Please enable camera access to capture crop images.', action: 'Enable' },
    kn: { title: 'ಕ್ಯಾಮೆರಾ ಅಗತ್ಯ', message: 'ಬೆಳೆ ಚಿತ್ರಗಳನ್ನು ಸೆರೆಹಿಡಿಯಲು ಕ್ಯಾಮೆರಾ ಪ್ರವೇಶವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ.', action: 'ಸಕ್ರಿಯಗೊಳಿಸಿ' },
    hi: { title: 'कैमरा आवश्यक', message: 'फसल की छवियां कैप्चर करने के लिए कैमरा एक्सेस सक्षम करें।', action: 'सक्षम करें' },
    ta: { title: 'கேமரா தேவை', message: 'பயிர் படங்களை எடுக்க கேமரா அணுகலை இயக்கவும்.', action: 'இயக்கு' },
    te: { title: 'కెమెరా అవసరం', message: 'పంట చిత్రాలను క్యాప్చర్ చేయడానికి కెమెరా యాక్సెస్‌ను ప్రారంభించండి.', action: 'ప్రారంభించు' },
  },

  NO_DATA_AVAILABLE: {
    en: { title: 'No Data', message: 'No data available. Please try again when you have internet connection.', action: 'Retry' },
    kn: { title: 'ಡೇಟಾ ಇಲ್ಲ', message: 'ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ. ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕವಿದ್ದಾಗ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮರುಪ್ರಯತ್ನಿಸಿ' },
    hi: { title: 'डेटा नहीं', message: 'डेटा उपलब्ध नहीं है। इंटरनेट कनेक्शन होने पर पुनः प्रयास करें।', action: 'पुनः प्रयास करें' },
    ta: { title: 'தரவு இல்லை', message: 'தரவு கிடைக்கவில்லை. இணைய இணைப்பு இருக்கும்போது மீண்டும் முயற்சிக்கவும்.', action: 'மீண்டும் முயற்சி' },
    te: { title: 'డేటా లేదు', message: 'డేటా అందుబాటులో లేదు. ఇంటర్నెట్ కనెక్షన్ ఉన్నప్పుడు మళ్ళీ ప్రయత్నించండి.', action: 'మళ్ళీ ప్రయత్నించు' },
  },

  VOICE_RECOGNITION_FAILED: {
    en: { title: 'Voice Not Recognized', message: 'Could not understand your voice. Please speak clearly and try again.', action: 'Try Again' },
    kn: { title: 'ಧ್ವನಿ ಗುರುತಿಸಲಿಲ್ಲ', message: 'ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
    hi: { title: 'आवाज पहचान नहीं', message: 'आपकी आवाज समझ नहीं आई। कृपया स्पष्ट बोलें और पुनः प्रयास करें।', action: 'पुनः प्रयास करें' },
    ta: { title: 'குரல் அடையாளம் காணப்படவில்லை', message: 'உங்கள் குரலைப் புரிந்துகொள்ள முடியவில்லை. தெளிவாகப் பேசி மீண்டும் முயற்சிக்கவும்.', action: 'மீண்டும் முயற்சி' },
    te: { title: 'వాయిస్ గుర్తించలేదు', message: 'మీ వాయిస్ అర్థం కాలేదు. దయచేసి స్పష్టంగా మాట్లాడి మళ్ళీ ప్రయత్నించండి.', action: 'మళ్ళీ ప్రయత్నించు' },
  },

  INVALID_INPUT: {
    en: { title: 'Invalid Input', message: 'Please check your input and try again.', action: 'OK' },
    kn: { title: 'ಅಮಾನ್ಯ ಇನ್‌ಪುಟ್', message: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇನ್‌ಪುಟ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಸರಿ' },
    hi: { title: 'अमान्य इनपुट', message: 'कृपया अपना इनपुट जांचें और पुनः प्रयास करें।', action: 'ठीक है' },
    ta: { title: 'தவறான உள்ளீடு', message: 'உங்கள் உள்ளீட்டை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.', action: 'சரி' },
    te: { title: 'చెల్లని ఇన్‌పుట్', message: 'దయచేసి మీ ఇన్‌పుట్‌ని తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి.', action: 'సరే' },
  },
};

// Get error message for a specific error code and language
export const getErrorMessage = (errorCode: string, language: Language = 'en'): ErrorMessage => {
  const messages = ERROR_MESSAGES[errorCode];
  if (!messages) {
    return ERROR_MESSAGES.SERVER_ERROR[language];
  }
  return messages[language] || messages.en;
};

// Map HTTP status codes to error codes
export const getErrorCodeFromStatus = (status: number): string => {
  switch (status) {
    case 401:
      return 'SESSION_EXPIRED';
    case 403:
      return 'LOGIN_FAILED';
    case 404:
      return 'NO_DATA_AVAILABLE';
    case 408:
      return 'TIMEOUT_ERROR';
    case 409:
      return 'PHONE_ALREADY_EXISTS';
    case 429:
      return 'RATE_LIMIT_ERROR';
    case 500:
    case 502:
    case 503:
      return 'SERVER_ERROR';
    default:
      return 'NETWORK_ERROR';
  }
};

// Get localized error from axios error
export const getLocalizedError = (error: any, language: Language = 'en'): ErrorMessage => {
  // Check for network errors
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return getErrorMessage('TIMEOUT_ERROR', language);
    }
    return getErrorMessage('NETWORK_ERROR', language);
  }

  // Get error code from response status
  const errorCode = getErrorCodeFromStatus(error.response.status);
  
  // Check for specific error codes from backend
  const backendErrorCode = error.response?.data?.errorCode;
  if (backendErrorCode && ERROR_MESSAGES[backendErrorCode]) {
    return getErrorMessage(backendErrorCode, language);
  }

  return getErrorMessage(errorCode, language);
};

// All supported error codes for testing
export const ERROR_CODES = Object.keys(ERROR_MESSAGES);

// All supported languages
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'kn', 'hi', 'ta', 'te'];
