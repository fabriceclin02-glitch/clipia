-- Clipia Social (Clipbook + ClipTok) — schéma Supabase. À coller dans « SQL Editor » puis « Run ».
create table if not exists profiles(id uuid primary key references auth.users on delete cascade, nom text not null, bio text default '', cree timestamptz default now());
create table if not exists posts(id bigint generated always as identity primary key, auteur uuid not null default auth.uid() references profiles(id) on delete cascade, appli text not null default 'clipbook' check (appli in ('clipbook','cliptok')), type text not null check (type in ('texte','photo','video')), texte text default '', media text default '', cree timestamptz default now());
create table if not exists likes(post_id bigint references posts(id) on delete cascade, user_id uuid default auth.uid() references profiles(id) on delete cascade, primary key(post_id,user_id));
create table if not exists comments(id bigint generated always as identity primary key, post_id bigint references posts(id) on delete cascade, auteur uuid not null default auth.uid() references profiles(id) on delete cascade, texte text not null, cree timestamptz default now());
create table if not exists follows(suiveur uuid default auth.uid() references profiles(id) on delete cascade, suivi uuid references profiles(id) on delete cascade, primary key(suiveur,suivi));
create table if not exists messages(id bigint generated always as identity primary key, de uuid not null default auth.uid() references profiles(id) on delete cascade, a uuid not null references profiles(id) on delete cascade, texte text not null, cree timestamptz default now());
create table if not exists signalements(id bigint generated always as identity primary key, auteur uuid default auth.uid(), post_id bigint, motif text, cree timestamptz default now());
create index if not exists posts_cree on posts(cree desc);
create index if not exists msg_a on messages(a, de, cree);

alter table profiles enable row level security; alter table posts enable row level security; alter table likes enable row level security;
alter table comments enable row level security; alter table follows enable row level security; alter table messages enable row level security; alter table signalements enable row level security;

create policy "profils lisibles" on profiles for select using (true);
create policy "profil: creer le mien" on profiles for insert with check (id = auth.uid());
create policy "profil: modifier le mien" on profiles for update using (id = auth.uid());
create policy "posts lisibles" on posts for select using (true);
create policy "posts: publier" on posts for insert with check (auteur = auth.uid());
create policy "posts: supprimer les miens" on posts for delete using (auteur = auth.uid());
create policy "likes lisibles" on likes for select using (true);
create policy "likes: ajouter" on likes for insert with check (user_id = auth.uid());
create policy "likes: retirer" on likes for delete using (user_id = auth.uid());
create policy "commentaires lisibles" on comments for select using (true);
create policy "commentaires: ajouter" on comments for insert with check (auteur = auth.uid());
create policy "commentaires: supprimer les miens" on comments for delete using (auteur = auth.uid());
create policy "abonnements lisibles" on follows for select using (true);
create policy "abonnements: ajouter" on follows for insert with check (suiveur = auth.uid());
create policy "abonnements: retirer" on follows for delete using (suiveur = auth.uid());
create policy "messages: les miens" on messages for select using (de = auth.uid() or a = auth.uid());
create policy "messages: envoyer" on messages for insert with check (de = auth.uid());
create policy "signalements: envoyer" on signalements for insert with check (true);

insert into storage.buckets (id, name, public) values ('media','media',true) on conflict (id) do nothing;
create policy "media lisibles" on storage.objects for select using (bucket_id = 'media');
create policy "media: envoyer (connecté)" on storage.objects for insert to authenticated with check (bucket_id = 'media');
