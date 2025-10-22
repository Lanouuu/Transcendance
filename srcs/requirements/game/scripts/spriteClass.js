class Sprite {
    constructor({position, velocity, image}) {
        this.image = new Image()
        this.image.src = image
        this.position = position
        this.loaded = false
        this.velocity = velocity
    }

    draw() {
        if (onload)
            this.loaded = true

        if (this.loaded) {
            canvasContext.drawImage(this.image, this.position.x, this.position.y)
        }
    }
}