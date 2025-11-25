all: up

##### DEV RULES ######################################
test: up_test

up_test: build_test
	docker compose -f ./srcs/docker-compose_test.yml up -d

build_test:
	docker compose -f ./srcs/docker-compose_test.yml build --no-cache

ret: clean up_test

######################################################


up: build
	docker compose -f ./srcs/docker-compose.yml up -d

down:
	docker compose -f ./srcs/docker-compose.yml down

stop:
	docker compose -f ./srcs/docker-compose.yml stop

start:
	docker compose -f ./srcs/docker-compose.yml start

build:
	docker compose -f ./srcs/docker-compose.yml build

clean:
	@docker stop $$(docker ps -qa) || true
	@docker rm $$(docker ps -qa) || true
	@docker rmi -f $$(docker images -qa) || true
	@docker volume rm $$(docker volume ls -q) || true
	@docker network rm $$(docker network ls -q) || true
	@rm srcs/requirements/gateway/www/css/output.css || true

re: clean up

prune: clean
	@docker system prune -a --volumes -f