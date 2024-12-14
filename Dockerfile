# Usa una imagen base de Ruby
FROM ruby:3.0.2

# Instala dependencias
RUN apt-get update -qq && apt-get install -y nodejs postgresql-client

# Configura el directorio de trabajo
WORKDIR /myapp

# Copia el Gemfile y Gemfile.lock
COPY Gemfile /myapp/Gemfile
COPY Gemfile.lock /myapp/Gemfile.lock

# Instala las gemas
RUN bundle install

# Copia el resto del código de la aplicación
COPY . /myapp

# Precompila los assets
RUN bundle exec rake assets:precompile

# Expone el puerto que usará la aplicación
EXPOSE 3000

# Comando para iniciar el servidor
CMD ["rails", "server", "-b", "0.0.0.0"]