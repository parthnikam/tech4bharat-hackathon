export type JobVoiceValues = {
  employerName: string;
  title: string;
  category: string;
  location: string;
  payMin: string;
  payMax: string;
  payPeriod: string;
  workType: string;
  description: string;
  requiredSkills: string;
};

const jobTypes = [
  { pattern: /(?:farm(?:ing)?|harvest(?:ing)?|agricultur\w*|खेती|कृषि|शेती|விவசாயம்|ಕೃಷಿ|వ్యవసాయం|কৃষি)/iu, title: "Farm worker", category: "Agriculture" },
  { pattern: /(?:mason|bricklayer|construction|निर्माण|मिस्त्री|கட்டுமானம்|கட்டட|నిర్మాణம்|নির্মাণ)/iu, title: "Construction worker", category: "Construction" },
  { pattern: /(?:driver|driving|chauffeur|ड्राइवर|चालक|ஓட்டுநர்|ಚಾಲಕ|డ్రైవర్|চালক)/iu, title: "Driver", category: "Transport" },
  { pattern: /(?:delivery|courier|डिलीवरी|விநியோகம்|ವಿತರಣೆ|డెలివరీ|বিতরণ)/iu, title: "Delivery worker", category: "Delivery" },
  { pattern: /(?:tailor|tailoring|stitch(?:ing)?|दर्जी|सिलाई|शिवणकाम|தையல்|ಹೊಲಿಗೆ|కుట్టు|সেলাই)/iu, title: "Tailor", category: "Tailoring" },
  { pattern: /(?:cook|cooking|chef|कुक|रसोइया|சமையலர்|ಅಡುಗೆ|వంట|রাঁধুনি)/iu, title: "Cook", category: "Food service" },
  { pattern: /(?:cleaner|cleaning|housekeep(?:er|ing)?|सफाई|சுத்தம்|ಸ್ವಚ್ಛತೆ|శుభ్రత|পরিষ্কার)/iu, title: "Cleaning staff", category: "Cleaning" },
  { pattern: /(?:warehouse|packing|packer|गोदाम|पैकिंग|கிடங்கு|ಗೋದಾಮು|గిడ్డంగి|গুদাম)/iu, title: "Warehouse worker", category: "Warehouse" },
  { pattern: /(?:sales|shop assistant|दुकान|बिक्री|விற்பனை|ಮಾರಾಟ|అమ్మకాలు|বিক্রয়)/iu, title: "Sales assistant", category: "Retail" }
];

function extractLocation(transcript: string) {
  const english = transcript.match(/\b(?:in|near|at|around)\s+([^,.;!?]{2,60})/iu)?.[1];
  if (english) {
    const location = english
      .split(/\b(?:and|with|pay|salary|wage|for|work|need|hours|per)\b|₹|रुपये|वेतन|पगार|में|जवळ|இல்|ನಲ್ಲಿ|లో|এ/iu)[0]
      ?.trim();
    if (location && location.split(/\s+/).length <= 5) return location.replace(/[.?!]+$/, "");
  }

  const indic = transcript.match(/([\p{L}\p{M}]+(?:[\s-]+[\p{L}\p{M}]+){0,3})\s+(?:में|जवळ|இல்|ನಲ್ಲಿ|లో|এ)/iu)?.[1];
  return indic?.trim() ?? "";
}

function extractPay(transcript: string) {
  const payPattern = /(?:₹|rs\.?|rupees?|रुपये|रु\.?|pay|salary|wage|paid|वेतन|मजदूरी|पगार|दिहाड़ी)\s*(?:is|of|around|लगभग|करीब)?\s*([\d,]+)(?:\s*(?:-|to|से|तक)\s*(?:₹|rs\.?|rupees?)?\s*([\d,]+))?/iu;
  const match = transcript.match(payPattern);
  if (!match) return {};
  const first = Number(match[1].replace(/,/g, ""));
  const second = match[2] ? Number(match[2].replace(/,/g, "")) : first;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second) || first < 1 || second < first) return {};
  return { payMin: String(first), payMax: String(second) };
}

export function parseJobVoice(transcript: string, current: JobVoiceValues): JobVoiceValues {
  const normalized = transcript.toLocaleLowerCase();
  const type = jobTypes.find(({ pattern }) => pattern.test(normalized));
  const pay = extractPay(transcript);
  const daily = /(?:\b(?:per day|daily|day wage)\b|दैनिक|रोज़|प्रतिदिन|தினசரி|ದಿನಗೂಲಿ|రోజువారీ|প্রতিদিন)/iu.test(normalized);
  const seasonal = /(?:\b(?:seasonal|temporary)\b|मौसमी|சீசன்|ಋತುಮಾನ|సీజనల్|মৌসুমি)/iu.test(normalized);
  const partTime = /(?:\bpart[- ]?time\b|अंशकालिक|பகுதி நேரம்|ಅರೆಕಾಲಿಕ|పార్ట్ టైమ్|খণ্ডকালীন)/iu.test(normalized);
  const skillPhrase = transcript.match(/(?:skills?(?: needed|required)?|must know|experience in|कौशल|कुशलता|திறன்கள்|ಕೌಶಲ್ಯ|నైపుణ్యాలు|দক্ষতা)\s*(?:are|is|हैं|है|:|-)?\s*([^,.;!?]{2,100})/iu)?.[1];
  const cleanedSkills = skillPhrase
    ?.split(/\b(?:pay|salary|wage|location|hours|schedule|work|per day|per month)\b|₹|वेतन|पगार|स्थान|वेतन/iu)[0]
    ?.trim();
  const employerName = transcript.match(/(?:business|employer|company|shop|farm)(?:\s+name)?\s+(?:is|called|:)\s*([^,.;!?]{2,60})/iu)?.[1]
    ?.split(/\b(?:need|hiring|looking for|job|work|location|pay|salary|wage)\b|₹/iu)[0]
    ?.trim();

  return {
    ...current,
    employerName: employerName || current.employerName,
    title: type?.title ?? current.title,
    category: type?.category ?? current.category,
    location: extractLocation(transcript) || current.location,
    ...pay,
    payPeriod: daily ? "day" : current.payPeriod,
    workType: seasonal ? "Seasonal" : partTime ? "Part-time" : current.workType,
    description: transcript,
    requiredSkills: cleanedSkills || current.requiredSkills
  };
}
