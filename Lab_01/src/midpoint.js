function MidpointPainter(context, width, height) {

    this.context = context;
    this.imageData = context.createImageData(width, height);
    this.points = [];
    this.now = [-1, -1];
    this.width = width;
    this.height = height;
    
    this.getPixelIndex = function(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height)
            return -1;
        return (x + y * width) << 2;
    }

    this.setPixel = function(x, y, rgba) {
        pixelIndex = this.getPixelIndex(x, y);
        if (pixelIndex == -1) return;
        for (var i = 0; i < 4; i++) {
            this.imageData.data[pixelIndex + i] = rgba[i];
        }
    }

    this.drawPoint = function(p, rgba){
        var x = p[0];
        var y = p[1];
        for (var i = -1; i <= 1; i++)
            for (var j = -1; j <= 1; j++)
                this.setPixel(x + i, y + j, rgba);
    }

    this.drawLine = function(p0, p1, rgba) {
        var x0 = p0[0], y0 = p0[1];
        var x1 = p1[0], y1 = p1[1];
        var radius = Math.round(Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)));
        var x = radius, y = 0;
        var p = 1 - radius;

        while (x >= y) {
            this.setPixel(x0 + x, y0 + y, rgba);
            this.setPixel(x0 - x, y0 + y, rgba);
            this.setPixel(x0 + x, y0 - y, rgba);
            this.setPixel(x0 - x, y0 - y, rgba);
            this.setPixel(x0 + y, y0 + x, rgba);
            this.setPixel(x0 - y, y0 + x, rgba);
            this.setPixel(x0 + y, y0 - x, rgba);
            this.setPixel(x0 - y, y0 - x, rgba);

            y++;
            if (p <= 0) {
                p = p + 2 * y + 1;
            } else {
                x--;
                p = p + 2 * y - 2 * x + 1;
            }
        }
    }


    this.drawBkg = function(rgba) {
        for (var i = 0; i < this.width; i++)
            for (var j = 0; j < this.height; j++)
                this.setPixel(i, j, rgba);
    }   

    this.clear = function() {
        this.points.length = 0;
        this.drawBkg(bgRgba);
        this.context.putImageData(this.imageData, 0, 0);
    }

    this.addPoint = function(p) {
        this.points.push(p);
    }

    this.draw = function(p) {
        var n = this.points.length;
        this.drawBkg(bgRgba);
        for (var i = 0; i < n; i++)
            this.drawPoint(this.points[i], pointRgba);
        for (var i = 0; i < n - 1; i++)
            this.drawLine(this.points[i], this.points[i + 1], lineRgba);
        if (n > 0 && (this.points[n - 1][0] != p[0] || this.points[n - 1][1] != p[1])) {
            this.drawLine(this.points[n - 1], p, vlineRgba);
        }
        this.context.putImageData(this.imageData, 0, 0);
    }

    this.clear();
    this.draw();
}
