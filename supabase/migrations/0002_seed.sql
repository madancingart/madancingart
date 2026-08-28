insert into public.locations (id, name, address, maps_url) values
  (
    'mikolow',
    'M&A Dancing Art Mikołów',
    'ul. Świerkowa 3, Mikołów',
    'https://www.google.com/maps/search/?api=1&query=ul.%20%C5%9Awierkowa%203%2C%20Miko%C5%82%C3%B3w'
  ),
  (
    'lubliniec',
    'M&A Dancing Art Lubliniec',
    'ul. Oleska 85, Lubliniec',
    'https://www.google.com/maps/search/?api=1&query=ul.%20Oleska%2085%2C%20Lubliniec'
  );

insert into public.class_types (slug, name, is_pair) values
  ('dzieci-4-7', 'Dzieci 4–7 lat', false),
  ('dzieci-8-14', 'Dzieci 8–14 lat', false),
  ('latino-solo', 'Latino Solo', false),
  ('taniec-uzytkowy', 'Taniec użytkowy', true),
  ('lekcja-indywidualna', 'Lekcja indywidualna', false),
  ('pro-am', 'Pro-Am', false);

-- Mikołów, poniedziałek (1)
insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 1, time '16:00', 45, null from public.class_types where slug = 'dzieci-4-7';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 1, time '17:00', 45, null from public.class_types where slug = 'dzieci-8-14';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 1, time '18:00', 50, null from public.class_types where slug = 'latino-solo';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 1, time '19:00', 50, null from public.class_types where slug = 'taniec-uzytkowy';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 1, time '20:00', 50, null from public.class_types where slug = 'latino-solo';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 1, time '21:00', 50, null from public.class_types where slug = 'latino-solo';

-- Lubliniec, wtorek (2)
insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 2, time '16:00', 45, null from public.class_types where slug = 'dzieci-8-14';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 2, time '17:00', 45, null from public.class_types where slug = 'dzieci-4-7';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 2, time '18:00', 90, 'zaawans.' from public.class_types where slug = 'latino-solo';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 2, time '19:45', 90, 'zaawans.' from public.class_types where slug = 'taniec-uzytkowy';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 2, time '21:15', 60, 'zaawans.' from public.class_types where slug = 'latino-solo';

-- Mikołów, czwartek (4)
insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 4, time '16:00', 45, null from public.class_types where slug = 'dzieci-4-7';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 4, time '18:00', 45, 'początk.' from public.class_types where slug = 'taniec-uzytkowy';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 4, time '19:20', 50, null from public.class_types where slug = 'latino-solo';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'mikolow', id, 4, time '20:20', 50, null from public.class_types where slug = 'latino-solo';

-- Lubliniec, piątek (5)
insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 5, time '16:00', 45, null from public.class_types where slug = 'dzieci-4-7';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 5, time '17:00', 90, 'zaawans.' from public.class_types where slug = 'latino-solo';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 5, time '18:30', 60, 'początk.' from public.class_types where slug = 'taniec-uzytkowy';

insert into public.recurring_classes (location_id, class_type_id, weekday, start_time, duration_min, level)
select 'lubliniec', id, 5, time '19:45', 90, 'zaawans.' from public.class_types where slug = 'taniec-uzytkowy';
