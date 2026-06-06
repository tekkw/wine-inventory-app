# 와인 재고관리 웹앱

React, Vite, Supabase, CSS로 만든 간단한 와인 재고관리 앱입니다. 화면에는 와인명, 입고, 출고, 현 수량만 표시되며 현 수량은 `입고 - 출고`로 자동 계산됩니다.

## 1. 설치

```bash
npm install
```

## 2. Supabase 테이블 만들기

Supabase 프로젝트의 SQL Editor에서 아래 SQL을 실행하세요.

```sql
create table if not exists public.wines (
  id uuid primary key default gen_random_uuid(),
  wine_name text not null,
  incoming integer not null default 0 check (incoming >= 0),
  outgoing integer not null default 0 check (outgoing >= 0),
  created_at timestamptz not null default now()
);

alter table public.wines enable row level security;

create policy "Anyone can read wines"
on public.wines
for select
using (true);

create policy "Anyone can insert wines"
on public.wines
for insert
with check (true);

create policy "Anyone can update wines"
on public.wines
for update
using (true)
with check (true);

create policy "Anyone can delete wines"
on public.wines
for delete
using (true);
```

## 3. 환경변수 설정

프로젝트 루트에 `.env` 파일을 만들고 Supabase 값을 넣으세요.

```bash
VITE_SUPABASE_URL=내_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=내_SUPABASE_ANON_KEY
```

Supabase 값은 Supabase 대시보드의 Project Settings > API에서 확인할 수 있습니다.

## 4. 로컬 실행

```bash
npm run dev
```

터미널에 표시되는 주소를 브라우저에서 열면 앱을 사용할 수 있습니다.

## 5. 배포 전 확인

```bash
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다.

## 6. Netlify 배포

Netlify에서 새 사이트를 만들고 이 프로젝트를 연결한 뒤 아래처럼 설정하세요.

- Build command: `npm run build`
- Publish directory: `dist`

Netlify의 Site configuration > Environment variables에 아래 값을 추가하세요.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

환경변수를 저장한 뒤 다시 배포하면 Supabase 데이터베이스와 연결됩니다.
