"use client";
import { useCallback, useEffect, useState } from "react";
type Doctor = {
  user_id: string;
  first_name: string;
  last_name: string;
  doctor_profiles: { specialty: string; bio: string; active: boolean } | null;
};
type Slot = {
  id: string;
  doctor_id: string;
  starts_at: string;
  location: string;
};
type Booking={id:string;patient_label:string;status:string;consultation_slots:Slot};
export default function AdminCare({ lang }: { lang: "ka" | "en" }) {
  const ka = lang === "ka";
  const [doctors, setDoctors] = useState<Doctor[]>([]),
    [slots, setSlots] = useState<Slot[]>([]),
    [id, setId] = useState(""),
    [specialty, setSpecialty] = useState(""),
    [bio, setBio] = useState(""),
    [active, setActive] = useState(false),
    [date, setDate] = useState(""),
    [location, setLocation] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [bookings,setBookings]=useState<Booking[]>([]),[moves,setMoves]=useState<Record<string,string>>({});
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/care", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setDoctors(d.doctors);
      setSlots(d.slots);
      setBookings(d.bookings||[]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function save(body: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
      setMessage(ka ? "შენახულია" : "Saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="care" className="workspace-card">
      <h2>
        {ka
          ? "ექიმების პროფილები და განრიგი"
          : "Doctor profiles & availability"}
      </h2>
      <p>
        {ka
          ? "სიაში მხოლოდ უკვე გადამოწმებული ექიმის ანგარიშებია. ჩართვა ექიმს კონსულტაციის გვერდზე გამოაჩენს. ვიზიტის ხანგრძლივობაა 30 წუთი. ადმინისტრატორი არ ხედავს პირად მიმოწერას ან ჯანმრთელობის ჩანაწერებს."
          : "Only independently verified doctor accounts are listed. Enable a profile to show it on the consultation page. Appointments last 30 minutes. Administrators cannot read private chats or health records here."}
      </p>
      <label>
        {ka ? "ექიმი" : "Doctor"}
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            const d = doctors.find(
              (d) => d.user_id === e.target.value,
            )?.doctor_profiles;
            setSpecialty(d?.specialty || "");
            setBio(d?.bio || "");
            setActive(d?.active || false);
          }}
        >
          <option value="">{ka ? "აირჩიე ექიმი" : "Choose doctor"}</option>
          {doctors.map((d) => (
            <option key={d.user_id} value={d.user_id}>
              {d.first_name} {d.last_name}
            </option>
          ))}
        </select>
      </label>
      {!doctors.length && (
        <p>
          {ka
            ? "გადამოწმებული ექიმი ჯერ არ არის. ჯერ საჭიროა ექიმის თანხმობა, ანგარიშის შექმნა და კვალიფიკაციის შემოწმება."
            : "No verified doctor accounts yet. Obtain consent, create their account, and verify qualifications first."}
        </p>
      )}
      {id && (
        <>
          <form
            className="workspace-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save({ action: "profile", id, specialty, bio, active });
            }}
          >
            <label>
              {ka ? "სპეციალობა" : "Specialty"}
              <input
                required
                maxLength={120}
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              />
            </label>
            <label>
              {ka ? "აღწერა" : "Bio"}
              <textarea
                maxLength={2000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              {ka ? "პროფილი გამოჩნდეს" : "Show profile"}
            </label>
            <button disabled={busy}>
              {ka ? "პროფილის შენახვა" : "Save profile"}
            </button>
          </form>
          <form
            className="workspace-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save({
                action: "slot",
                id,
                starts_at: new Date(date).toISOString(),
                location,
              });
            }}
          >
            <h3>{ka ? "ახალი თავისუფალი დრო" : "Add availability"}</h3>
            <label>
              {ka
                ? "თარიღი და დრო (ადგილობრივი დრო)"
                : "Date and time (local timezone)"}
              <input
                type="datetime-local"
                step={1800}
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              {ka ? "კლინიკა და მისამართი" : "Clinic and address"}
              <input
                required
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <button
              disabled={
                busy || !doctors.find((d) => d.user_id === id)?.doctor_profiles
              }
            >
              {ka ? "დროის დამატება" : "Add slot"}
            </button>
          </form>
          {slots
            .filter((s) => s.doctor_id === id)
            .map((s) => (
              <div key={s.id}>
                <p>
                  {new Date(s.starts_at).toLocaleString(ka ? "ka-GE" : "en-GB")}{" "}
                  · {s.location}
                </p>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        ka ? "წაიშალოს თავისუფალი დრო?" : "Delete this slot?",
                      )
                    )
                      void save({ action: "delete-slot", id: s.id });
                  }}
                >
                  {ka ? "წაშლა" : "Delete"}
                </button>
              </div>
            ))}
        </>
      )}
      <section className="order-history"><h2>{ka?'ვიზიტების მართვა':'Appointment management'}</h2><p>{ka?'ბოლო 100 ჯავშანი. გადატანა შეათანხმე პაციენტთან; ახალ დროს იგივე ექიმი უნდა ემსახურებოდეს.':'Latest 100 bookings. Agree rescheduling with the patient; the new slot must belong to the same doctor.'}</p>{!bookings.length&&<p>{ka?'ჯავშნები ჯერ არ არის.':'No appointments yet.'}</p>}{bookings.map(b=><article className="order-card" key={b.id}><h3>{b.patient_label}</h3><p>{new Date(b.consultation_slots.starts_at).toLocaleString(ka?'ka-GE':'en-GB')} · {b.consultation_slots.location} · {b.status==='confirmed'?(ka?'დადასტურებული':'Confirmed'):(ka?'გაუქმებული':'Cancelled')}</p>{b.status==='confirmed'&&<><button disabled={busy} type="button" onClick={()=>{if(confirm(ka?'გაუქმდეს ჯავშანი? პაციენტს ცვლილება ცალკე შეატყობინე.':'Cancel this booking? Notify the patient separately.'))void save({action:'cancel-booking',id:b.id})}}>{ka?'გაუქმება':'Cancel'}</button><label>{ka?'გადატანა სხვა დროზე':'Reschedule'}<select value={moves[b.id]||''} onChange={e=>setMoves({...moves,[b.id]:e.target.value})}><option value="">{ka?'აირჩიე დრო':'Choose a slot'}</option>{slots.filter(s=>s.doctor_id===b.consultation_slots.doctor_id&&s.id!==b.consultation_slots.id&&!bookings.some(other=>other.status==='confirmed'&&other.consultation_slots.id===s.id)).map(s=><option key={s.id} value={s.id}>{new Date(s.starts_at).toLocaleString(ka?'ka-GE':'en-GB')} · {s.location}</option>)}</select></label><button disabled={busy||!moves[b.id]} type="button" onClick={()=>{if(confirm(ka?'პაციენტთან შეთანხმებული ახალი დრო შეინახოს?':'Save the new time agreed with the patient?'))void save({action:'reschedule-booking',id:b.id,slotId:moves[b.id]})}}>{ka?'დროის შეცვლა':'Reschedule'}</button></>}</article>)}</section>
      <p role="status">{message}</p>
    </section>
  );
}
