import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://mdheeokbtvwuricvzpyc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TSzn_Xildnh16dTSIpPtAw_0TMcK6wY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // Supabase do zaimportowania przed użyciem bazy w innym pliku

export async function pobierzDane(nazwaTabeli, kolumnaZWlasciwymId, id){
    const { data, error } = await supabase
    .from(nazwaTabeli)
    .select('*')
    .eq(kolumnaZWlasciwymId, id)

    if (error) {
    console.error("Błąd:", error.message);
    return null;
    }

    return data;
}

export async function nowyRekord(nazwaTabeli, noweDane) {
  const { data, error } = await supabase
    .from(nazwaTabeli)
    .insert([noweDane])

  if (error) {
    console.error("Błąd:", error.message);
    return false;
  }

  console.log("Dodano pomyślnie:", data);
  return true;
}

export async function edytujRekord(nazwaTabeli, kolumnaZWlasciwymId, id, zmiany) {
  const { data, error } = await supabase
    .from(nazwaTabeli)
    .update(zmiany)
    .eq(kolumnaZWlasciwymId, id)

  if (error) {
    console.error("Błąd:", error.message);
    return false;
  }

  console.log("Zaktualizowano pomyślnie:", data);
  return true;
}

export async function usunRekord(nazwaTabeli, id) {
  const { error } = await supabase
    .from(nazwaTabeli)
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Błąd:", error.message);
    return false;
  }

  console.log("Usunięto pomyślnie");
  return true;
}

