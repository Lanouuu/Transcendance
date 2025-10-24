class Sprite {
    constructor({position, velocity, image, key}) {
        this.image = new Image()
        this.image.src = image
        this.position = position
        this.loaded = false
        this.velocity = velocity
        this.key = key
    }

    draw() {
        if (onload)
            this.loaded = true

        if (this.loaded) {
            canvasContext.drawImage(this.image, this.position.x, this.position.y)
        }
    }
}