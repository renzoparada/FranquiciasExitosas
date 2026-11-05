-- =====================================================================
-- 0002 · Plantilla del Método ESCALA® (propiedad de Franquicias Exitosas)
--        Estructura · Desarrolla · Expande
-- =====================================================================

create table public.tpl_steps (
  code                     public.step_code primary key,
  letter                   char(1) not null,
  name                     text not null,
  stage                    text not null,
  pillar                   public.pillar not null,
  sort                     int  not null unique,
  ref_duration             text not null,
  default_weeks            int  not null,
  starts_at_first_opening  boolean not null default false,
  closing_gate             public.gate_code,
  description              text
);

create table public.tpl_gates (
  code      public.gate_code primary key,
  name      text not null,
  sort      int  not null unique,
  step_code public.step_code not null references public.tpl_steps(code),
  criterion text not null
);

create table public.tpl_tasks (
  id                 uuid primary key default gen_random_uuid(),
  step_code          public.step_code not null references public.tpl_steps(code),
  title              text not null,
  description        text,
  specialty          public.specialty,
  default_visibility public.visibility not null default 'cliente',
  due_week           int  not null default 1,     -- semana del paso en que vence (1 = primera)
  sort               int  not null default 0
);

create table public.tpl_deliverables (
  id              uuid primary key default gen_random_uuid(),
  step_code       public.step_code not null references public.tpl_steps(code),
  title           text not null,
  description     text,
  release_trigger text not null default 'firma',   -- cuota que libera la descarga: firma | RENTABLE | REPLICABLE (regla 7)
  sort            int  not null default 0
);

create table public.tpl_info_requests (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  title        text not null,
  description  text,
  is_trademark boolean not null default false,
  sort         int  not null default 0
);

create table public.tpl_criteria (
  code    text primary key,
  name    text not null,
  weight  numeric(5,2) not null check (weight > 0 and weight <= 100),
  is_veto boolean not null default false,
  guide   text,
  sort    int not null
);

create table public.tpl_manual_sections (
  code  text primary key,
  title text not null,
  sort  int  not null
);

-- ---------------------------------------------------------------------
-- Datos de la plantilla
-- ---------------------------------------------------------------------
insert into public.tpl_steps (code, letter, name, stage, pillar, sort, ref_duration, default_weeks, starts_at_first_opening, closing_gate, description) values
 ('E',  'E', 'Evaluar la franquiciabilidad', '1. Diagnóstico',        'estructuracion', 1, '3-5 semanas',            4,  false, 'FRANQUICIABLE', 'Diagnóstico integral del negocio para decidir si se franquicia, se ajusta o todavía no.'),
 ('S',  'S', 'Sustentar el modelo',          '2. Diseño del modelo',  'estructuracion', 2, '4-6 semanas',            6,  false, 'RENTABLE',      'Diseño del concepto, formatos, modelo financiero y estructura contractual.'),
 ('C',  'C', 'Codificar el know-how',        '3. Sistema operativo',  'desarrollo',     3, '6-10 semanas',           10, false, 'REPLICABLE',    'Manuales, recetario, capacitación y sistema de auditoría.'),
 ('A1', 'A', 'Atraer franquiciados',         '4. Expansión comercial','expansion',      4, '4-6 semanas',            6,  false, 'VENDIBLE',      'Perfil, selección, dossier y captación de franquiciados.'),
 ('L',  'L', 'Lanzar unidades',              '5. Aperturas',          'expansion',      5, 'desde la 1.ª apertura',  13, true,  null,            'Preapertura, entrenamiento, apertura asistida y seguimiento de 90 días.'),
 ('A2', 'A', 'Acompañar la red',             '5. Supervisión',        'expansion',      6, '6-12 meses',             52, true,  'AUTONOMA',      'Auditorías, KPIs, Central de Franquicias y comité de franquiciados.');

insert into public.tpl_gates (code, name, sort, step_code, criterion) values
 ('FRANQUICIABLE', 'Franquiciable', 1, 'E',  'Decisión escrita de franquiciar, ajustar o no franquiciar.'),
 ('RENTABLE',      'Rentable',      2, 'S',  'Payback del franquiciado validado.'),
 ('REPLICABLE',    'Replicable',    3, 'C',  'Turno piloto aprobado usando solo el manual.'),
 ('VENDIBLE',      'Vendible',      4, 'A1', 'Primer contrato de franquicia firmado.'),
 ('AUTONOMA',      'Autónoma',      5, 'A2', 'La red opera sin el consultor.');

insert into public.tpl_tasks (step_code, title, specialty, default_visibility, due_week, sort) values
 -- E · Evaluar la franquiciabilidad
 ('E', 'Entrevista al fundador',                                   'operaciones', 'cliente', 1, 1),
 ('E', 'Auditoría financiera de 12 meses por local',               'financiero',  'cliente', 3, 2),
 ('E', 'Observación operativa en los locales',                     'operaciones', 'cliente', 2, 3),
 ('E', 'Revisión legal y de marca (SENAPI)',                       'legal',       'cliente', 2, 4),
 ('E', 'Estudio de competidores',                                  'marketing',   'cliente', 3, 5),
 ('E', 'Matriz de franquiciabilidad',                              null,          'cliente', 4, 6),
 ('E', 'Informe de franquiciabilidad',                             null,          'cliente', 4, 7),
 -- S · Sustentar el modelo
 ('S', 'Concepto y producto insignia',                             'marketing',   'cliente', 1, 1),
 ('S', 'Formatos: kiosco, isla, local pequeño, dark kitchen y módulo móvil', 'operaciones', 'cliente', 2, 2),
 ('S', 'Planta central vs. punto de venta',                        'alimentos',   'cliente', 3, 3),
 ('S', 'Modelo financiero en 3 escenarios',                        'financiero',  'cliente', 4, 4),
 ('S', 'Canon, regalía y fondo de marketing',                      'financiero',  'cliente', 5, 5),
 ('S', 'Tipos de franquicia',                                      'legal',       'cliente', 5, 6),
 ('S', 'Carta de intención (CIF) y contrato base',                 'legal',       'cliente', 6, 7),
 -- C · Codificar el know-how
 ('C', 'Manual de operaciones (53 puntos)',                        'operaciones', 'cliente', 8, 1),
 ('C', 'Recetario estandarizado: gramajes, costo por porción, vida útil y cadena de frío', 'alimentos', 'cliente', 6, 2),
 ('C', 'Manual de imagen',                                         'marketing',   'cliente', 4, 3),
 ('C', 'Manual de atención al cliente',                            'operaciones', 'cliente', 5, 4),
 ('C', 'Manual de higiene',                                        'alimentos',   'cliente', 5, 5),
 ('C', 'Manual de apertura y cierre',                              'operaciones', 'cliente', 6, 6),
 ('C', 'Manual de compras e inventarios',                          'operaciones', 'cliente', 7, 7),
 ('C', 'Programa de capacitación',                                 'operaciones', 'cliente', 9, 8),
 ('C', 'Checklist de auditoría',                                   'operaciones', 'cliente', 9, 9),
 ('C', 'Stack tecnológico mínimo',                                 'tecnologia',  'cliente', 10, 10),
 -- A · Atraer franquiciados
 ('A1', 'Perfil del franquiciado',                                 'marketing',   'cliente', 1, 1),
 ('A1', 'Proceso de selección',                                    'legal',       'cliente', 2, 2),
 ('A1', 'Dossier comercial',                                       'marketing',   'cliente', 3, 3),
 ('A1', 'Marketing de captación',                                  'marketing',   'cliente', 4, 4),
 ('A1', 'Manual de selección de locales',                          'operaciones', 'cliente', 5, 5),
 ('A1', 'Plan de expansión a 5 años',                              'financiero',  'cliente', 6, 6),
 -- L · Lanzar unidades
 ('L', 'Preapertura',                                              'operaciones', 'cliente', 2, 1),
 ('L', 'Entrenamiento del equipo del franquiciado',                'operaciones', 'cliente', 3, 2),
 ('L', 'Apertura asistida',                                        'operaciones', 'cliente', 4, 3),
 ('L', 'Seguimiento de 90 días',                                   'operaciones', 'cliente', 13, 4),
 -- A · Acompañar la red
 ('A2', 'Auditorías periódicas',                                   'operaciones', 'cliente', 12, 1),
 ('A2', 'Tablero de KPIs por unidad',                              'tecnologia',  'cliente', 8, 2),
 ('A2', 'Central de Franquicias',                                  'operaciones', 'cliente', 16, 3),
 ('A2', 'Comité de franquiciados',                                 null,          'cliente', 26, 4),
 ('A2', 'Innovación del menú',                                     'alimentos',   'cliente', 40, 5);

insert into public.tpl_deliverables (step_code, title, release_trigger, sort) values
 ('E',  'Informe de franquiciabilidad',            'firma',      1),
 ('E',  'Matriz de franquiciabilidad',             'firma',      2),
 ('E',  'Estudio de competidores',                 'firma',      3),
 ('S',  'Concepto y producto insignia',            'RENTABLE',   1),
 ('S',  'Modelo financiero (3 escenarios)',        'RENTABLE',   2),
 ('S',  'Estructura de canon, regalía y fondo de marketing', 'RENTABLE', 3),
 ('S',  'Carta de intención (CIF)',                'RENTABLE',   4),
 ('S',  'Contrato base de franquicia',             'RENTABLE',   5),
 ('C',  'Manual de operaciones (53 puntos)',       'REPLICABLE', 1),
 ('C',  'Recetario estandarizado',                 'REPLICABLE', 2),
 ('C',  'Manual de imagen',                        'REPLICABLE', 3),
 ('C',  'Manual de atención',                      'REPLICABLE', 4),
 ('C',  'Manual de higiene',                       'REPLICABLE', 5),
 ('C',  'Manual de apertura y cierre',             'REPLICABLE', 6),
 ('C',  'Manual de compras e inventarios',         'REPLICABLE', 7),
 ('C',  'Programa de capacitación',                'REPLICABLE', 8),
 ('C',  'Checklist de auditoría',                  'REPLICABLE', 9),
 ('C',  'Stack tecnológico mínimo',                'REPLICABLE', 10),
 ('A1', 'Perfil del franquiciado',                 'REPLICABLE', 1),
 ('A1', 'Proceso de selección',                    'REPLICABLE', 2),
 ('A1', 'Dossier comercial',                       'REPLICABLE', 3),
 ('A1', 'Plan de marketing de captación',          'REPLICABLE', 4),
 ('A1', 'Manual de selección de locales',          'REPLICABLE', 5),
 ('A1', 'Plan de expansión a 5 años',              'REPLICABLE', 6),
 ('L',  'Plan de preapertura',                     'REPLICABLE', 1),
 ('L',  'Informe de apertura asistida',            'REPLICABLE', 2),
 ('L',  'Informe de seguimiento de 90 días',       'REPLICABLE', 3),
 ('A2', 'Informe de auditoría periódica',          'REPLICABLE', 1),
 ('A2', 'Tablero de KPIs por unidad',              'REPLICABLE', 2),
 ('A2', 'Reglamento de la Central de Franquicias', 'REPLICABLE', 3),
 ('A2', 'Plan de innovación del menú',             'REPLICABLE', 4);

insert into public.tpl_info_requests (category, title, description, is_trademark, sort) values
 ('Legal',      'Registro de marca (SENAPI)',            'Certificado o constancia de trámite de la marca ante SENAPI.', true,  1),
 ('Legal',      'Documentos societarios',                'Testimonio de constitución, poder del representante, NIT, matrícula de comercio.', false, 2),
 ('Operación',  'Puntos de venta',                       'Listado de locales con dirección, superficie, horario y formato.', false, 3),
 ('Finanzas',   'Ventas de 12 a 24 meses',               'Ventas mensuales por local (reporte del sistema o libro de ventas).', false, 4),
 ('Finanzas',   'Costos',                                'Estructura de costos fijos y variables por local.', false, 5),
 ('Producto',   'Recetas',                               'Recetas actuales de los productos principales.', false, 6),
 ('Operación',  'Proveedores',                            'Listado de proveedores clave, condiciones y frecuencia de compra.', false, 7),
 ('Producto',   'Menú',                                  'Carta vigente con precios por tamaño.', false, 8),
 ('Marketing',  'Redes sociales',                        'Cuentas, accesos de lectura y métricas disponibles.', false, 9),
 ('Comercial',  'Interesados en franquicias',            'Personas que ya consultaron por una franquicia (nombre, ciudad, contacto).', false, 10),
 ('Estrategia', 'Metas a 5 años',                        'Metas del fundador: número de unidades, ciudades y países.', false, 11);

insert into public.tpl_criteria (code, name, weight, is_veto, sort, guide) values
 ('rentabilidad',    'Rentabilidad',                20, true,  1, 'Margen y utilidad comprobados por local.'),
 ('concepto',        'Concepto diferenciado',       15, false, 2, 'Propuesta de valor clara y difícil de copiar.'),
 ('transferibilidad','Transferibilidad',            15, false, 3, '¿El know-how se puede enseñar a un tercero?'),
 ('trayectoria',     'Trayectoria',                 10, false, 4, 'Años de operación y estabilidad de las ventas.'),
 ('simplicidad',     'Simplicidad operativa',       10, false, 5, 'Pocos pasos, equipos y perfiles críticos.'),
 ('suministro',      'Cadena de suministro',        10, false, 6, 'Proveedores y logística replicables.'),
 ('proteccion_legal','Protección legal',            10, true,  7, 'Marca registrada y contratos en orden.'),
 ('portabilidad',    'Portabilidad',                 5, false, 8, '¿Funciona en otras ciudades y formatos?'),
 ('fundador',        'Disposición del fundador',     5, false, 9, 'Tiempo, apertura y compromiso del fundador.');

-- Índice estándar de 53 puntos del manual de operaciones (editable por marca).
insert into public.tpl_manual_sections (code, title, sort)
select lpad(n::text, 2, '0'),
       (array[
        'Bienvenida e historia de la marca','Misión, visión y valores','Organigrama de la unidad','Perfiles y funciones de cargo','Horarios y turnos',
        'Uniforme y presentación personal','Apertura de la unidad','Cierre de la unidad','Manejo de caja','Arqueo y depósitos',
        'Atención al cliente: protocolo','Manejo de quejas y reclamos','Toma de pedidos','Tiempos de servicio','Presentación de productos',
        'Recetario estandarizado','Gramajes y porciones','Costo por porción','Vida útil de insumos','Cadena de frío',
        'Recepción de mercadería','Almacenamiento','Rotación PEPS','Inventarios','Compras y pedidos a proveedores',
        'Proveedores homologados','Limpieza y desinfección','Control de plagas','Manejo de residuos','Higiene del personal',
        'Seguridad alimentaria','Seguridad industrial','Mantenimiento de equipos','Equipamiento estándar','Layout de la unidad',
        'Imagen y señalética','Material de punto de venta','Promociones','Redes sociales locales','Fondo de marketing',
        'Sistema de ventas (POS)','Reportes diarios','Indicadores clave (KPIs)','Reporte de regalías','Capacitación inicial',
        'Capacitación continua','Auditorías de la franquiciante','Plan de acción correctivo','Comunicación con la central','Relación con el franquiciante',
        'Gestión de personal','Emergencias y contingencias','Glosario y anexos'
       ])[n],
       n
from generate_series(1, 53) as n;
