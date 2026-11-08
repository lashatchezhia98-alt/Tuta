"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import HeaderActions from "@/components/header-actions";

type Lang = "ka" | "en";
type Kind = "privacy" | "terms";

const copy = {
  privacy: {
    ka: {
      title: "კონფიდენციალურობა",
      intro:
        "შენი პირადი ინფორმაცია დაცულია. აქ მოკლედ აღწერილია, როგორ მუშაობს თუთას ამჟამინდელი ვერსია.",
      sections: [
        [
          "ექიმთან ჩატის ვადა და პროფილის ფოტო",
          "ჩატის შეტყობინება გაგზავნიდან 48 საათში აღარ ჩანს და აქტიური ბაზიდან ავტომატურად იშლება. ჩატის ადგილობრივი არქივი არ იქმნება. პროვაიდერის სარეზერვო ასლებს შენახვის ცალკე ვადა აქვს; სხვის მიერ გადაღებულ ეკრანის ფოტოებსა და ასლებს ვერ წავშლით. პროფილის ფოტო მხოლოდ გადამოწმებულ ექიმს შეიძლება ჰქონდეს.",
        ],
        [
          "ანგარიში და ჯანმრთელობის მონაცემები",
          "ანგარიშის, პერიოდისა და დღიურის მონაცემები დაცულ ბაზაში ინახება. ჩანაწერები აპსა და ვებსაიტს შორის სინქრონდება და პოსტებში ავტომატურად არ ჩანს. ადმინისტრატორის პანელში შენი ჯანმრთელობის დღიური და პირადი მიმოწერა არ იკითხება. პარტნიორთან მხოლოდ თავად არჩეული მონაცემები ზიარდება, შენი თანხმობით; გაზიარების გაუქმება ნებისმიერ დროს შეგიძლია.",
        ],
        [
          "რას ხედავენ სხვები",
          "მთავარ გვერდზე პოსტებსა და კომენტარებს მხოლოდ შესული მომხმარებლები ხედავენ. ანონიმური პოსტის ავტორის სახელი სხვებს არ ეჩვენებათ. თუ ფოტოს დაამატებ, ის Cloudinary-ზე აიტვირთება. გამოაქვეყნე მხოლოდ ის, რისი გაზიარებაც გსურს.",
        ],
        [
          "შენი კონტროლი",
          "საკუთარი პოსტის შეცვლა ან წაშლა შეგიძლია. მობილურ აპში შესაძლებელია ჯანმრთელობის ჩანაწერების ექსპორტი ან წაშლა. ძველი ჩანაწერები მოწყობილობიდან მხოლოდ ანგარიშში წარმატებით გადატანის შემდეგ წაიშლება.",
        ],
        [
          "მარკეტი, ფოტოები და წერილები",
          "შეკვეთის მიმღების სახელი, მისამართი და სურვილისამებრ არჩეული პინი ბაზაში ინახება და მიწოდებისთვის ადმინისტრატორს უჩანს. გადახდის გვერდს Flitt მართავს; თუთა ბარათის სრულ მონაცემებს არ ინახავს. ფოტოები Cloudinary-ზე, ანგარიშის წერილები Mailtrap-ით მუშავდება. პოსტის ფოტოს ბმული შეიძლება სხვამ გადააზიაროს, ამიტომ მასზე კონფიდენციალური ინფორმაცია არ განათავსო. ბრაუზერში კალათისთვის მხოლოდ პროდუქტის კოდები და რაოდენობები ინახება, არა ჯანმრთელობის დღიური ან მიწოდების მისამართი.",
        ],
      ],
    },
    en: {
      title: "Privacy",
      intro:
        "Your personal information is protected. This page explains how the current version of Tuta works.",
      sections: [
        [
          "Doctor chat retention and profile photos",
          "Messages disappear 48 hours after sending and are automatically deleted from the active database. No local chat archive is created. Provider backups have separate retention; screenshots and copies made by others cannot be erased. Only verified doctors may have profile photos.",
        ],
        [
          "Account and health data",
          "Account, period and journal data are stored in a protected database and synced between app and website. They do not appear automatically in posts. The admin panel does not expose health journals or private chats. Partner sharing requires your explicit choice of data; you can revoke it at any time.",
        ],
        [
          "What others can see",
          "Only signed-in members can see posts and comments on Home. Anonymous posts do not show the author’s name to others. If you add a photo, it is uploaded to Cloudinary. Share only what you want others to see.",
        ],
        [
          "Your control",
          "You can edit or delete your own post. The mobile app lets you export or delete your health entries. Older device records are removed only after a successful account import.",
        ],
        [
          "Market, photos and email",
          "Recipient name, delivery address and an optional chosen pin are saved to the database and available to administrators for fulfillment. Flitt hosts payment entry; Tuta does not store full card details. Cloudinary handles photos and Mailtrap handles account email. Photo URLs may be reshared, so do not upload confidential information. The browser stores only product IDs and quantities for the shopping cart, not health journals or delivery addresses.",
        ],
      ],
    },
  },
  terms: {
    ka: {
      title: "წესები და პირობები",
      intro: "ეს წესები აღწერს თუთას ამჟამად ხელმისაწვდომ ფუნქციებს.",
      sections: [
        [
          "რას აკეთებს თუთა",
          "თუთა გაძლევს პერიოდის სავარაუდო პროგნოზს, კალენდარს, დღიურს და მომხმარებელთა მთავარ გვერდს. პროგნოზი შეფასებაა და არა დიაგნოზი ან კონტრაცეფციის მეთოდი.",
        ],
        [
          "საზოგადოების წესები",
          "პოსტი მაქსიმუმ 200 სიტყვას და ერთ ფოტოს შეიძლება შეიცავდეს. არ გამოაქვეყნო სხვისი პირადი მონაცემები, შეურაცხმყოფელი ტექსტი ან სპამი. შეგიძლია შეცვალო ან წაშალო საკუთარი პოსტი და დაარეპორტო დარღვევა.",
        ],
        [
          "ანგარიში და Premium",
          "პოსტებისა და პირადი ჩანაწერებისთვის ანგარიში საჭიროა. Premium მოიცავს განმეორებადი სიმპტომების ანალიზს, ანგარიშებს, ორსულობის დამატებით თვალყურის დევნებას, პარტნიორთან გაზიარებას და ხელმისაწვდომ ექიმთან ჩატსა და ჯავშანს. ფასი: 4.99 ₾ / 30 დღე ან 49.90 ₾ / წელი. გადახდა ჯერ მხოლოდ სატესტოა, რეალური თანხა არ ჩამოიჭრება და ავტომატური განახლება ჩართული არ არის.",
        ],
        [
          "ექიმები და შეკვეთები",
          "ექიმის ხელმისაწვდომობა დამოკიდებულია მის პროფილსა და თავისუფალ დროზე. ვიზიტის გადატანა პაციენტთან შეთანხმებას საჭიროებს. ეს არ არის გადაუდებელი დახმარება. მარკეტის გადახდისა და მიწოდების სტატუსები განცალკევებულია; შეკვეთის გაუქმება თანხას ავტომატურად არ აბრუნებს. რეალური გაყიდვები ამ ვერსიაში არ არის ჩართული.",
        ],
      ],
    },
    en: {
      title: "Terms of use",
      intro: "These terms describe the features currently available in Tuta.",
      sections: [
        [
          "What Tuta does",
          "Tuta offers estimated period predictions, a calendar, a journal and a member Home feed. Predictions are estimates, not a diagnosis or a method of contraception.",
        ],
        [
          "Community rules",
          "A post may contain up to 200 words and one photo. Do not post another person’s private information, abuse or spam. You can edit or delete your own post and report violations.",
        ],
        [
          "Account and Premium",
          "An account is required for posts and personal records. Premium includes repeating symptom analysis, reports, additional pregnancy tracking, partner sharing and chat/booking with available doctors. Prices are GEL 4.99 for 30 days or GEL 49.90 per year. Payments are test-only: no real charge and no automatic renewal.",
        ],
        [
          "Doctors and orders",
          "Doctor availability depends on active profiles and open appointment times. Rescheduling requires agreement with the patient. This is not emergency care. Market payment and delivery statuses are separate; cancellation does not automatically issue a refund. Real sales are not enabled in this version.",
        ],
      ],
    },
  },
} as const;

export function PolicyPage({ kind }: { kind: Kind }) {
  const [lang, setLang] = useState<Lang>("ka");
  useEffect(() => {
    if (localStorage.getItem("tuta-language") === "en")
      queueMicrotask(() => setLang("en"));
  }, []);
  const change = (next: Lang) => {
    setLang(next);
    localStorage.setItem("tuta-language", next);
    document.documentElement.lang = next;
  };
  const text = copy[kind][lang];
  return (
    <main className="min-h-screen bg-[#F9F8FC] px-5 py-6 text-[#1E1B2E] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="inner-logo">
            <BrandMark />
            <strong>{lang === "ka" ? "თუთა" : "TUTA"}</strong>
          </Link>
          <HeaderActions lang={lang} setLang={change} />
        </header>
        <p className="mt-6">
          <Link href={kind === "privacy" ? "/terms" : "/privacy"}>
            {kind === "privacy"
              ? lang === "ka"
                ? "წესები და პირობები"
                : "Terms of use"
              : lang === "ka"
                ? "კონფიდენციალურობა"
                : "Privacy"}
          </Link>
        </p>
        <div className="mt-12 rounded-[30px] bg-[#E3D8F1] p-7 sm:mt-16 sm:p-10">
          <p className="text-xs font-semibold tracking-[.18em]">TUTA</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">
            {text.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7">{text.intro}</p>
        </div>
        <div className="mt-6 grid gap-4">
          {text.sections.map(([heading, body]) => (
            <section
              key={heading}
              className="rounded-3xl border border-[#1E1B2E]/10 bg-white p-6 sm:p-8"
            >
              <h2 className="text-xl font-semibold leading-snug">{heading}</h2>
              <p className="mt-3 text-base leading-7 text-[#514B5F]">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
