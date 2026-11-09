-- =====================================================================
--  ReLeaf — testy WHO-5 i Big Five (IPIP), schemat od Waldka (9.11.2026)
--  STATUS: PROTOTYP DO POPRAWY. Waldek: „ma dużo błędów”. Nie wdrażać w tej
--  postaci; przerabiamy całość razem z resztą schematu przy podłączaniu backendu.
--  Zastępuje sekcję 6 „Testy (PHQ-9, GAD-7, PSS-10)” w supabase-schema.sql.
--
--  UWAGI DO PRZEJRZENIA PRZED WDROŻENIEM (Claude, 9.11.2026):
--   1. target_group 'ADULT' — nasi użytkownicy to nastolatki. Normy stenowe
--      Big Five (IPIP) są zwykle dla dorosłych; trzeba sprawdzić, czy mamy
--      normy dla młodzieży, inaczej steny będą mylące. WHO-5 jest używany
--      też u młodzieży.
--   2. user_consents: polityka FOR ALL pozwala użytkownikowi SKASOWAĆ wiersz
--      zgody, a wtedy tracimy dowód zgody (art. 5 ust. 2). Lepiej: tylko
--      SELECT + INSERT, a wycofanie = ustawienie withdrawn_at (UPDATE tylko
--      tej kolumny albo funkcja RPC).
--   3. ip_address wpisywany z telefonu da się podrobić — ustawiać po stronie
--      serwera (Edge Function). IP to też dane osobowe: ustalić okres
--      przechowywania.
--   4. assessment_sessions: FOR ALL pozwala klientowi wpisać dowolny
--      raw_score / interpretation_code. Wynik liczyć na serwerze (funkcja
--      RPC albo Edge Function) z odpowiedzi.
--   5. deleted_at (soft delete) a „usuń historię”: przy żądaniu usunięcia
--      (RODO art. 17) dane muszą zniknąć naprawdę — soft delete najwyżej
--      na krótki czas „Cofnij”, potem twarde usunięcie.
--   6. „Dane muszą być szyfrowane”: Supabase szyfruje dysk (at rest) i ruch
--      (TLS). Ustalić, czy to wystarcza, czy szyfrujemy kolumny / po stronie
--      telefonu jak Skrytkę (wtedy serwer nie policzy wyników ani insightów).
--   7. Brak limitu „raz w tygodniu” z planu — dodać, jeśli zostaje.
-- =====================================================================

-- 1. Tabela definicji kwestionariuszy (np. WHO-5, Big Five)
CREATE TABLE questionnaires (
    id VARCHAR(32) PRIMARY KEY, -- np. 'WHO-5', 'IPIP-50'
    name VARCHAR(100) NOT NULL,
    version VARCHAR(10) NOT NULL,
    target_group VARCHAR(50) NOT NULL, -- np. 'ADULT'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela pytań w kwestionariuszu
CREATE TABLE questionnaire_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questionnaire_id VARCHAR(32) REFERENCES questionnaires(id) ON DELETE CASCADE,
    question_order INT NOT NULL,
    question_text TEXT NOT NULL,
    is_reverse_scored BOOLEAN DEFAULT FALSE, -- przydatne dla pytań odwróconych (np. Big Five)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela zgód użytkownika (RODO Art. 9 - dane wrażliwe/zdrowotne)
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL, -- np. 'WELLBEING_DATA_PROCESSING'
    consent_version VARCHAR(20) NOT NULL,
    given_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 4. Tabela sesji wypełnienia kwestionariusza (Wyniki ogólne)
CREATE TABLE assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    questionnaire_id VARCHAR(32) REFERENCES questionnaires(id),
    consent_id UUID REFERENCES user_consents(id),
    raw_score INT NOT NULL,
    scaled_score DECIMAL(5,2), -- np. wynik procentowy dla WHO-5 (0-100) lub steny dla Big Five
    interpretation_code VARCHAR(50) NOT NULL, -- kod interpretacji do wyświetlenia na froncie
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL -- do mechanizmu soft-delete / RODO
);

-- 5. Tabela szczegółowych odpowiedzi na poszczególne pytania
CREATE TABLE assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questionnaire_questions(id),
    selected_value INT NOT NULL, -- zaznaczona wartość punktowa (np. 0-5)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indeksy dla przyspieszenia ładowania historii użytkownika
CREATE INDEX idx_assessment_sessions_user ON assessment_sessions(user_id, completed_at DESC);


--------------------------------------------------------------------------------
-- BEZPIECZEŃSTWO: ROW LEVEL SECURITY (RLS)
--------------------------------------------------------------------------------

-- Włączenie RLS dla tabel prywatnych
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_responses ENABLE ROW LEVEL SECURITY;

-- Włączenie RLS dla tabel słownikowych (odczyt publiczny / dla zalogowanych)
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_questions ENABLE ROW LEVEL SECURITY;

-- Polityki dostępu: Użytkownik widzi/edytuje tylko swoje dane
CREATE POLICY "Users can manage their own consents" ON user_consents
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own assessment sessions" ON assessment_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own responses" ON assessment_responses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM assessment_sessions
            WHERE assessment_sessions.id = assessment_responses.session_id
            AND assessment_sessions.user_id = auth.uid()
        )
    );

-- Polityki dla słowników (każdy zalogowany/uwierzytelniony może pobrać pytania i testy)
CREATE POLICY "Anyone can read active questionnaires" ON questionnaires
    FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can read questionnaire questions" ON questionnaire_questions
    FOR SELECT USING (true);
