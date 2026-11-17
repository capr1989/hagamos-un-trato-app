-- HUT phase 1. Apply only to the reviewed HUT development project after validation.
-- No companies, addresses, market boundaries or enabled launch market are invented.
insert into public.countries(code,name,default_locale,is_active) values ('PA','Panamá','es-PA',false);
insert into public.categories(code,name,slug,sort_order,is_active) values
 ('aire_acondicionado','Aire acondicionado','aire-acondicionado',10,true),
 ('energia_solar','Energía solar','energia-solar',20,true);
insert into public.services(category_id,code,name,slug,sort_order,is_active)
 select c.id,v.code,v.name,v.slug,v.sort_order,true from public.categories c join (values
 ('aire_acondicionado','instalacion','Instalación','instalacion',10),
 ('aire_acondicionado','reparacion','Reparación','reparacion',20),
 ('aire_acondicionado','mantenimiento_preventivo','Mantenimiento preventivo','mantenimiento-preventivo',30),
 ('aire_acondicionado','limpieza','Limpieza','limpieza',40),
 ('aire_acondicionado','venta_equipos','Venta de equipos','venta-de-equipos',50),
 ('energia_solar','instalacion','Instalación','instalacion',10),
 ('energia_solar','mantenimiento','Mantenimiento','mantenimiento',20),
 ('energia_solar','reparacion','Reparación','reparacion',30),
 ('energia_solar','diseno_dimensionamiento','Diseño y dimensionamiento','diseno-y-dimensionamiento',40),
 ('energia_solar','venta_equipos','Venta de equipos','venta-de-equipos',50)
 ) as v(category_code,code,name,slug,sort_order) on c.code=v.category_code;
